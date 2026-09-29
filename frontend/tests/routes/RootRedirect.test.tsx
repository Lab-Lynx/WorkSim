import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RootRedirect from "@/routes/RootRedirect";
import * as apiClient from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { User } from "@/types";

const mockUser: User = {
    id: "usr-123",
    name: "Alex Candidate",
    email: "alex@example.com",
    role: "student",
    emailVerifiedAt: "2026-09-01T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
};

function LocationDisplay() {
    const location = useLocation();
    return (
        <div data-testid="location-display">
            <span data-testid="pathname">{location.pathname}</span>
            <span data-testid="search">{location.search}</span>
        </div>
    );
}

function renderRootRedirect(
    queryClient: QueryClient,
    initialEntries: string[] = ["/"]
) {
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                    <Route path="/" element={<RootRedirect />} />
                    <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard Page</div>} />
                    <Route path="/login" element={<LocationDisplay />} />
                    <Route path="*" element={<LocationDisplay />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe("FE-066: RootRedirect (doc 10 §10.14, doc 6 A-38, doc 11 §11.2.11)", () => {
    let queryClient: QueryClient;
    let apiRequestSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retryDelay: 0,
                },
            },
        });
        apiRequestSpy = vi.spyOn(apiClient, "apiRequest");
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("RootRedirect — pending: shows FullPageLoader while useMe is pending", () => {
        apiRequestSpy.mockReturnValue(new Promise(() => { }));

        renderRootRedirect(queryClient, ["/"]);

        expect(screen.getByRole("status", { name: /loading application/i })).toBeInTheDocument();
        expect(screen.getByText("Loading...")).toBeInTheDocument();
        expect(screen.queryByTestId("dashboard-page")).not.toBeInTheDocument();
        expect(screen.queryByTestId("location-display")).not.toBeInTheDocument();
    });

    it("RootRedirect — success: redirects to /dashboard with replace", async () => {
        apiRequestSpy.mockResolvedValueOnce({
            statusCode: 200,
            message: "Current user",
            data: { user: mockUser },
        });

        renderRootRedirect(queryClient, ["/"]);

        await waitFor(() => {
            expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
        });
        expect(screen.queryByTestId("location-display")).not.toBeInTheDocument();
    });

    it("RootRedirect — 401 error: redirects to /login with replace and no from parameter", async () => {
        apiRequestSpy.mockRejectedValue(new ApiError(401, "Unauthorized", "api"));

        renderRootRedirect(queryClient, ["/"]);

        await waitFor(() => {
            expect(screen.getByTestId("pathname")).toHaveTextContent("/login");
        });
        expect(screen.getByTestId("search")).toHaveTextContent("");
        expect(screen.queryByTestId("dashboard-page")).not.toBeInTheDocument();
    });

    it("RootRedirect — network/5xx error: redirects to /login with replace and no from parameter", async () => {
        apiRequestSpy.mockRejectedValue(new ApiError(0, "Failed to fetch", "network"));

        renderRootRedirect(queryClient, ["/"]);

        await waitFor(() => {
            expect(screen.getByTestId("pathname")).toHaveTextContent("/login");
        });
        expect(screen.getByTestId("search")).toHaveTextContent("");
        expect(screen.queryByTestId("dashboard-page")).not.toBeInTheDocument();
    });
});
