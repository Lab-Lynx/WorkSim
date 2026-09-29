import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as apiClient from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { User } from "@/types";
import PublicOnly from "@/routes/PublicOnly";

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

function renderPublicOnly(
    queryClient: QueryClient,
    initialEntries: string[] = ["/login"],
    withChildren: boolean = true
) {
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                    {withChildren ? (
                        <Route
                            path="/login"
                            element={
                                <PublicOnly>
                                    <div data-testid="public-content">Public Login Form</div>
                                </PublicOnly>
                            }
                        />
                    ) : (
                        <Route element={<PublicOnly />}>
                            <Route
                                path="/login"
                                element={<div data-testid="public-outlet-content">Public Outlet Content</div>}
                            />
                        </Route>
                    )}
                    <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard Page</div>} />
                    <Route path="/tickets/:id" element={<div data-testid="ticket-page">Ticket Page</div>} />
                    <Route path="*" element={<LocationDisplay />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe("FE-065: PublicOnly (doc 10 §10.14, doc 11 §11.2.11, doc 11 §11.9)", () => {
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

    it("PublicOnly — pending: shows FullPageLoader while useMe is pending", () => {
        apiRequestSpy.mockReturnValue(new Promise(() => { }));

        renderPublicOnly(queryClient, ["/login"]);

        expect(screen.getByRole("status", { name: /loading application/i })).toBeInTheDocument();
        expect(screen.getByText("Loading...")).toBeInTheDocument();
        expect(screen.queryByTestId("public-content")).not.toBeInTheDocument();
        expect(screen.queryByTestId("dashboard-page")).not.toBeInTheDocument();
    });

    it("PublicOnly — authenticated: redirects to /dashboard with replace when no 'from' is present", async () => {
        apiRequestSpy.mockResolvedValueOnce({
            statusCode: 200,
            message: "Current user",
            data: { user: mockUser },
        });

        renderPublicOnly(queryClient, ["/login"]);

        await waitFor(() => {
            expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
        });
        expect(screen.queryByTestId("public-content")).not.toBeInTheDocument();
    });

    it("PublicOnly — authenticated: redirects to the safe 'from' path when provided", async () => {
        apiRequestSpy.mockResolvedValueOnce({
            statusCode: 200,
            message: "Current user",
            data: { user: mockUser },
        });

        renderPublicOnly(queryClient, ["/login?from=%2Ftickets%2Fticket-456%3Ftab%3Ddiff"]);

        await waitFor(() => {
            expect(screen.getByTestId("ticket-page")).toBeInTheDocument();
        });
        expect(screen.queryByTestId("public-content")).not.toBeInTheDocument();
    });

    it("PublicOnly — authenticated: falls back to /dashboard if 'from' is unsafe / open redirect", async () => {
        apiRequestSpy.mockResolvedValueOnce({
            statusCode: 200,
            message: "Current user",
            data: { user: mockUser },
        });

        renderPublicOnly(queryClient, ["/login?from=%2F%2Fevil.com%2Fexploit"]);

        await waitFor(() => {
            expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
        });
        expect(screen.queryByTestId("public-content")).not.toBeInTheDocument();
    });

    it("PublicOnly — error: renders public children when useMe returns 401", async () => {
        apiRequestSpy.mockRejectedValue(new ApiError(401, "Unauthorized", "api"));

        renderPublicOnly(queryClient, ["/login"]);

        await waitFor(() => {
            expect(screen.getByTestId("public-content")).toBeInTheDocument();
        });
        expect(screen.queryByTestId("dashboard-page")).not.toBeInTheDocument();
    });

    it("PublicOnly — error: renders public children when useMe encounters a network or 5xx error", async () => {
        apiRequestSpy.mockRejectedValue(new ApiError(0, "Failed to fetch", "network"));

        renderPublicOnly(queryClient, ["/login"]);

        await waitFor(() => {
            expect(screen.getByTestId("public-content")).toBeInTheDocument();
        });
        expect(screen.queryByTestId("dashboard-page")).not.toBeInTheDocument();
    });

    it("PublicOnly — outlet support: renders Outlet when children prop is omitted", async () => {
        apiRequestSpy.mockRejectedValue(new ApiError(401, "Unauthorized", "api"));

        renderPublicOnly(queryClient, ["/login"], false);

        await waitFor(() => {
            expect(screen.getByTestId("public-outlet-content")).toBeInTheDocument();
        });
    });
});
