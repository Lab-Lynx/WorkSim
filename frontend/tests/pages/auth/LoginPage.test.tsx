import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LoginPage, { LOGIN_NOTICE_MESSAGES } from '@/pages/auth/LoginPage';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';

const mockUser: User = {
    id: 'usr-123',
    name: 'Taylor Dev',
    email: 'taylor@example.com',
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
        </div>
    );
}

function renderLoginPage(
    queryClient: QueryClient,
    initialEntries: Array<string | { pathname: string; search?: string; hash?: string; state?: unknown }> = ['/login']
) {
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard Page</div>} />
                    <Route path="/tickets/:id" element={<div data-testid="ticket-page">Ticket Page</div>} />
                    <Route path="*" element={<LocationDisplay />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe('FE-068 · LoginPage (doc 10 §10.22 PG-02; doc 6 PG-02; doc 11 §11.2.18)', () => {
    let queryClient: QueryClient;
    let apiRequestSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        useAuthStore.getState().clearAuth();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });
        apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('Notice mapping', () => {
        it('maps session_expired notice to exact text in a status banner', () => {
            renderLoginPage(queryClient, [
                { pathname: '/login', state: { notice: 'session_expired' } },
            ]);

            const banner = screen.getByRole('status');
            expect(banner).toBeInTheDocument();
            expect(banner).toHaveTextContent(LOGIN_NOTICE_MESSAGES.session_expired);
            expect(banner).toHaveTextContent('Your session expired. Log in again.');
        });

        it('maps password_reset notice to exact text in a status banner', () => {
            renderLoginPage(queryClient, [
                { pathname: '/login', state: { notice: 'password_reset' } },
            ]);

            const banner = screen.getByRole('status');
            expect(banner).toBeInTheDocument();
            expect(banner).toHaveTextContent(LOGIN_NOTICE_MESSAGES.password_reset);
            expect(banner).toHaveTextContent('Password reset. Log in with your new password.');
        });

        it('maps logged_out_all notice to exact text in a status banner', () => {
            renderLoginPage(queryClient, [
                { pathname: '/login', state: { notice: 'logged_out_all' } },
            ]);

            const banner = screen.getByRole('status');
            expect(banner).toBeInTheDocument();
            expect(banner).toHaveTextContent(LOGIN_NOTICE_MESSAGES.logged_out_all);
            expect(banner).toHaveTextContent("You've been logged out of all devices.");
        });

        it('ignores unknown notice keys and renders no status banner', () => {
            renderLoginPage(queryClient, [
                { pathname: '/login', state: { notice: 'unexpected_notice_xyz' } },
            ]);

            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });

        it('renders no banner when state has no notice', () => {
            renderLoginPage(queryClient, ['/login']);

            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
    });

    describe('Form structure and Accessibility', () => {
        it('sets document.title to "Log in"', () => {
            renderLoginPage(queryClient);

            expect(document.title).toContain('Log in');
        });

        it('renders heading "Welcome back" with tabIndex={-1}', () => {
            renderLoginPage(queryClient);

            const heading = screen.getByRole('heading', { level: 1 });
            expect(heading).toHaveTextContent(/^welcome back$/i);
            expect(heading).toHaveAttribute('tabIndex', '-1');
        });

        it('renders email input with label and correct type/autocomplete', () => {
            renderLoginPage(queryClient);

            const emailInput = screen.getByLabelText(/^email$/i);
            expect(emailInput).toBeInTheDocument();
            expect(emailInput).toHaveAttribute('type', 'email');
            expect(emailInput).toHaveAttribute('autoComplete', 'email');
        });

        it('renders password input with PasswordInput show/hide toggle and autocomplete', () => {
            renderLoginPage(queryClient);

            const passwordInput = screen.getByLabelText(/^password$/i);
            expect(passwordInput).toBeInTheDocument();
            expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');

            // PasswordInput show/hide toggle button
            const toggleBtn = screen.getByRole('button', { name: /show password|hide password/i });
            expect(toggleBtn).toBeInTheDocument();
        });

        it('renders submit button "Log in"', () => {
            renderLoginPage(queryClient);

            const submitBtn = screen.getByRole('button', { name: /^log in$/i });
            expect(submitBtn).toBeInTheDocument();
        });

        it('renders links to forgot password and register', () => {
            renderLoginPage(queryClient);

            const forgotLink = screen.getByRole('link', { name: /forgot (your )?password\?/i });
            expect(forgotLink).toBeInTheDocument();
            expect(forgotLink).toHaveAttribute('href', '/forgot-password');

            const registerLink = screen.getByRole('link', { name: /create an account/i });
            expect(registerLink).toBeInTheDocument();
            expect(registerLink).toHaveAttribute('href', '/register');
        });

        it('does NOT contain a "remember me" checkbox or control', () => {
            renderLoginPage(queryClient);

            expect(screen.queryByLabelText(/remember/i)).not.toBeInTheDocument();
            expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
            expect(screen.queryByText(/remember/i)).not.toBeInTheDocument();
        });
    });

    describe('Validation', () => {
        it('prevents submission when fields are empty and shows validation errors', async () => {
            renderLoginPage(queryClient);

            const submitBtn = screen.getByRole('button', { name: /^log in$/i });
            fireEvent.click(submitBtn);

            await waitFor(() => {
                expect(screen.getByText(/email is required/i)).toBeInTheDocument();
                expect(screen.getByText(/password is required/i)).toBeInTheDocument();
            });

            expect(apiRequestSpy).not.toHaveBeenCalled();
        });

        it('shows error on invalid email format', async () => {
            renderLoginPage(queryClient);

            fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'not-an-email' } });
            fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret123' } });

            const submitBtn = screen.getByRole('button', { name: /^log in$/i });
            fireEvent.click(submitBtn);

            await waitFor(() => {
                expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
            });

            expect(apiRequestSpy).not.toHaveBeenCalled();
        });
    });

    describe('Successful login & safe redirect', () => {
        it('navigates with replace to safe destination from search params on success and seeds cache', async () => {
            apiRequestSpy.mockResolvedValueOnce({
                statusCode: 200,
                message: 'Logged in',
                data: { user: mockUser },
            });

            renderLoginPage(queryClient, ['/login?from=%2Ftickets%2Fticket-123']);

            fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'taylor@example.com' } });
            fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });

            const submitBtn = screen.getByRole('button', { name: /^log in$/i });
            fireEvent.click(submitBtn);

            await waitFor(() => {
                expect(screen.getByTestId('ticket-page')).toBeInTheDocument();
            });

            expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/login', {
                body: { email: 'taylor@example.com', password: 'password123' },
            });

            expect(queryClient.getQueryData(queryKeys.me)).toEqual(mockUser);
            expect(useAuthStore.getState().user).toEqual(mockUser);
        });

        it('falls back to /dashboard when from parameter is unsafe (e.g. absolute URL or protocol-relative)', async () => {
            apiRequestSpy.mockResolvedValueOnce({
                statusCode: 200,
                message: 'Logged in',
                data: { user: mockUser },
            });

            renderLoginPage(queryClient, ['/login?from=https%3A%2F%2Fmalicious-site.com%2Fsteal']);

            fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'taylor@example.com' } });
            fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });

            const submitBtn = screen.getByRole('button', { name: /^log in$/i });
            fireEvent.click(submitBtn);

            await waitFor(() => {
                expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
            });
        });

        it('falls back to /dashboard when no from parameter is provided', async () => {
            apiRequestSpy.mockResolvedValueOnce({
                statusCode: 200,
                message: 'Logged in',
                data: { user: mockUser },
            });

            renderLoginPage(queryClient, ['/login']);

            fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'taylor@example.com' } });
            fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });

            const submitBtn = screen.getByRole('button', { name: /^log in$/i });
            fireEvent.click(submitBtn);

            await waitFor(() => {
                expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
            });
        });
    });

    describe('Error handling', () => {
        it('handles 401: shows server error in root, clears password field, focuses password input, and keeps email', async () => {
            apiRequestSpy.mockRejectedValueOnce(
                new ApiError(401, 'Invalid email or password', 'api')
            );

            renderLoginPage(queryClient);

            const emailInput = screen.getByLabelText(/^email$/i);
            const passwordInput = screen.getByLabelText(/^password$/i);

            fireEvent.change(emailInput, { target: { value: 'taylor@example.com' } });
            fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

            const submitBtn = screen.getByRole('button', { name: /^log in$/i });
            fireEvent.click(submitBtn);

            await waitFor(() => {
                expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
            });

            // Email is preserved
            expect(emailInput).toHaveValue('taylor@example.com');

            // Password is reset/cleared
            expect(passwordInput).toHaveValue('');

            // Password input receives focus
            expect(passwordInput).toHaveFocus();
        });

        it('handles 429: shows rate limit error in root and form remains usable', async () => {
            apiRequestSpy.mockRejectedValueOnce(
                new ApiError(429, 'Too many login attempts. Please try again in 15 minutes.', 'api')
            );

            renderLoginPage(queryClient);

            const emailInput = screen.getByLabelText(/^email$/i);
            const passwordInput = screen.getByLabelText(/^password$/i);

            fireEvent.change(emailInput, { target: { value: 'taylor@example.com' } });
            fireEvent.change(passwordInput, { target: { value: 'password123' } });

            const submitBtn = screen.getByRole('button', { name: /^log in$/i });
            fireEvent.click(submitBtn);

            await waitFor(() => {
                expect(screen.getByText(/too many login attempts/i)).toBeInTheDocument();
            });

            // Form remains usable
            expect(emailInput).not.toBeDisabled();
            expect(passwordInput).not.toBeDisabled();
            expect(submitBtn).not.toBeDisabled();
        });
    });

    describe('Pending state', () => {
        it('disables form inputs and displays pending indicator while login is in flight', async () => {
            let resolveLogin: (val: unknown) => void;
            apiRequestSpy.mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveLogin = resolve;
                    })
            );

            renderLoginPage(queryClient);

            const emailInput = screen.getByLabelText(/^email$/i);
            const passwordInput = screen.getByLabelText(/^password$/i);

            fireEvent.change(emailInput, { target: { value: 'taylor@example.com' } });
            fireEvent.change(passwordInput, { target: { value: 'password123' } });

            const submitBtn = screen.getByRole('button', { name: /^log in$/i });
            fireEvent.click(submitBtn);

            await waitFor(() => {
                expect(screen.getByText(/logging in/i)).toBeInTheDocument();
            });

            expect(emailInput).toBeDisabled();
            expect(passwordInput).toBeDisabled();
            expect(submitBtn).toBeDisabled();

            act(() => {
                resolveLogin({
                    statusCode: 200,
                    message: 'Logged in',
                    data: { user: mockUser },
                });
            });

            await waitFor(() => {
                expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
            });
        });
    });
});
