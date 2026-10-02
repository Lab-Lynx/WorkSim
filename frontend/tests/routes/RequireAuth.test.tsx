import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { User } from '@/types';
import RequireAuth from '@/routes/RequireAuth';

const mockUser: User = {
    id: 'usr-123',
    name: 'Alex Student',
    email: 'alex@example.com',
    role: 'student',
    emailVerifiedAt: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
};

function LocationDisplay() {
    const location = useLocation();
    return (
        <div data-testid="location-display">
            <span data-testid="pathname">{location.pathname}</span>
            <span data-testid="search">{location.search}</span>
            <span data-testid="notice">{location.state?.notice ?? ''}</span>
        </div>
    );
}

function renderRequireAuth(
    queryClient: QueryClient,
    initialEntries: string[] = ['/dashboard'],
    withChildren: boolean = true
) {
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                    {withChildren ? (
                        <Route
                            path="/dashboard"
                            element={
                                <RequireAuth>
                                    <div data-testid="protected-content">Protected Dashboard Content</div>
                                </RequireAuth>
                            }
                        />
                    ) : (
                        <Route element={<RequireAuth />}>
                            <Route
                                path="/dashboard"
                                element={<div data-testid="protected-outlet-content">Protected Outlet Content</div>}
                            />
                        </Route>
                    )}
                    <Route path="/login" element={<LocationDisplay />} />
                    <Route path="*" element={<LocationDisplay />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe('FE-064: RequireAuth (doc 10 §10.14, doc 11 §11.2.11, doc 11 §11.9)', () => {
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
        apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('RequireAuth — pending: shows FullPageLoader while useMe is pending', () => {
        apiRequestSpy.mockReturnValue(new Promise(() => { }));

        renderRequireAuth(queryClient);

        expect(screen.getByRole('status', { name: /loading application/i })).toBeInTheDocument();
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('RequireAuth — first-load 401: redirects to buildLoginRedirect(pathname + search) with replace and no session expired notice', async () => {
        apiRequestSpy.mockRejectedValue(new ApiError(401, 'Unauthorized', 'api'));

        renderRequireAuth(queryClient, ['/dashboard?tab=mentor']);

        await waitFor(() => {
            expect(screen.getByTestId('pathname')).toHaveTextContent('/login');
        });

        expect(screen.getByTestId('search')).toHaveTextContent(
            '?from=' + encodeURIComponent('/dashboard?tab=mentor')
        );

        expect(screen.getByTestId('notice')).toHaveTextContent('');
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('RequireAuth — network/5xx: shows centered ErrorState with Retry button and does not redirect', async () => {
        const networkError = new ApiError(0, 'Failed to fetch', 'network');
        apiRequestSpy.mockRejectedValue(networkError);

        renderRequireAuth(queryClient, ['/dashboard']);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        expect(screen.queryByTestId('location-display')).not.toBeInTheDocument();
        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

        const retryBtn = screen.getByRole('button', { name: /retry|try again/i });
        expect(retryBtn).toBeInTheDocument();

        apiRequestSpy.mockResolvedValueOnce({
            statusCode: 200,
            message: 'Current user',
            data: { user: mockUser },
        });

        fireEvent.click(retryBtn);

        await waitFor(() => {
            expect(screen.getByTestId('protected-content')).toBeInTheDocument();
        });
    });

    it('RequireAuth — success: renders protected children', async () => {
        apiRequestSpy.mockResolvedValueOnce({
            statusCode: 200,
            message: 'Current user',
            data: { user: mockUser },
        });

        renderRequireAuth(queryClient);

        await waitFor(() => {
            expect(screen.getByTestId('protected-content')).toBeInTheDocument();
        });

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument();
    });

    it('RequireAuth — outlet support: renders Outlet when children prop is omitted', async () => {
        apiRequestSpy.mockResolvedValueOnce({
            statusCode: 200,
            message: 'Current user',
            data: { user: mockUser },
        });

        renderRequireAuth(queryClient, ['/dashboard'], false);

        await waitFor(() => {
            expect(screen.getByTestId('protected-outlet-content')).toBeInTheDocument();
        });
    });
});
