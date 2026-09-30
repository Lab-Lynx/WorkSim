import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '@/pages/auth/RegisterPage';
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
    emailVerifiedAt: null,
    createdAt: '2026-09-28T00:00:00.000Z',
};

function renderRegisterPage(queryClient: QueryClient) {
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/register']}>
                <RegisterPage />
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe('FE-067 · RegisterPage (doc 10 §10.22 PG-01; doc 6 PG-01; doc 11 §11.2.17)', () => {
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

    it('initial form: renders title, required fields, hint, submit button, and login link without success view', () => {
        renderRegisterPage(queryClient);

        // Document title
        expect(document.title).toContain('Create account');

        // Heading with tabIndex={-1}
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toHaveTextContent(/create (your )?account/i);
        expect(heading).toHaveAttribute('tabIndex', '-1');

        // Name, email, and password fields
        expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();

        // Password hint
        expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();

        // Submit button
        expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();

        // Login link
        const loginLink = screen.getByRole('link', { name: /log in|sign in/i });
        expect(loginLink).toBeInTheDocument();
        expect(loginLink).toHaveAttribute('href', '/login');

        // Success view not present
        expect(screen.queryByRole('heading', { name: /check your email/i })).not.toBeInTheDocument();
    });

    it('validation: prevents submission on invalid fields and displays client validation errors', async () => {
        renderRegisterPage(queryClient);

        const submitBtn = screen.getByRole('button', { name: /create account/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
            expect(screen.getByText(/email is required|enter a valid email/i)).toBeInTheDocument();
            expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
        });

        expect(apiRequestSpy).not.toHaveBeenCalled();
    });

    it('success: registers user, seeds queryKeys.me, replaces card in-place with "Check your email" view, and focuses heading', async () => {
        apiRequestSpy.mockResolvedValueOnce({
            statusCode: 201,
            message: 'User registered',
            data: { user: mockUser },
        });

        renderRegisterPage(queryClient);

        fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Taylor Dev' } });
        fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'taylor@example.com' } });
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });

        const submitBtn = screen.getByRole('button', { name: /create account/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: /check your email/i })).toBeInTheDocument();
        });

        // Heading has tabIndex={-1} and is focused
        const successHeading = screen.getByRole('heading', { level: 1, name: /check your email/i });
        expect(successHeading).toHaveAttribute('tabIndex', '-1');
        expect(successHeading).toHaveFocus();

        // Sent message with registered email
        expect(screen.getByText(/sent a verification link to/i)).toHaveTextContent('taylor@example.com');

        // Seeds queryKeys.me (D-10) and auth store
        expect(queryClient.getQueryData(queryKeys.me)).toEqual(mockUser);
        expect(useAuthStore.getState().user).toEqual(mockUser);

        // Dashboard navigation control
        const dashboardLink = screen.getByRole('link', { name: /go to dashboard|continue/i });
        expect(dashboardLink).toBeInTheDocument();
        expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    it('server 409: maps duplicate email error to email field and focuses email input', async () => {
        apiRequestSpy.mockRejectedValueOnce(
            new ApiError(409, 'An account with this email address already exists', 'api')
        );

        renderRegisterPage(queryClient);

        const nameInput = screen.getByLabelText(/^name$/i);
        const emailInput = screen.getByLabelText(/^email$/i);
        const passwordInput = screen.getByLabelText(/^password$/i);

        fireEvent.change(nameInput, { target: { value: 'Taylor Dev' } });
        fireEvent.change(emailInput, { target: { value: 'taylor@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        const submitBtn = screen.getByRole('button', { name: /create account/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText(/an account with this email address already exists/i)).toBeInTheDocument();
        });

        // Email input must be focused on 409
        expect(emailInput).toHaveFocus();
    });

    it('resend: clicks Resend verification email, displays server message unchanged, and enters cooldown', async () => {
        // 1. Successful registration
        apiRequestSpy.mockResolvedValueOnce({
            statusCode: 201,
            message: 'User registered',
            data: { user: mockUser },
        });

        renderRegisterPage(queryClient);

        fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Taylor Dev' } });
        fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'taylor@example.com' } });
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });

        fireEvent.click(screen.getByRole('button', { name: /create account/i }));

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: /check your email/i })).toBeInTheDocument();
        });

        // 2. Resend verification
        apiRequestSpy.mockResolvedValueOnce({
            statusCode: 200,
            message: 'Verification email resent',
            data: null,
        });

        const resendBtn = screen.getByRole('button', { name: /resend verification email/i });
        expect(resendBtn).not.toBeDisabled();

        fireEvent.click(resendBtn);

        await waitFor(() => {
            expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/resend-verification', {
                body: { email: 'taylor@example.com' },
            });
            expect(screen.getByText(/verification email resent/i)).toBeInTheDocument();
        });

        // Button should now be in cooldown
        expect(resendBtn).toBeDisabled();

        // Advance timers past 60s cooldown
        act(() => {
            vi.advanceTimersByTime(60_000);
        });

        await waitFor(() => {
            expect(resendBtn).not.toBeDisabled();
        });
    });

    it('pending: disables form fields and shows pending indicator while registration is in flight', async () => {
        let resolveRegistration: (val: unknown) => void;
        apiRequestSpy.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveRegistration = resolve;
                })
        );

        renderRegisterPage(queryClient);

        const nameInput = screen.getByLabelText(/^name$/i);
        const emailInput = screen.getByLabelText(/^email$/i);
        const passwordInput = screen.getByLabelText(/^password$/i);

        fireEvent.change(nameInput, { target: { value: 'Taylor Dev' } });
        fireEvent.change(emailInput, { target: { value: 'taylor@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        const submitBtn = screen.getByRole('button', { name: /create account/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText(/creating account/i)).toBeInTheDocument();
        });

        expect(nameInput).toBeDisabled();
        expect(emailInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();
        expect(submitBtn).toBeDisabled();

        act(() => {
            resolveRegistration({
                statusCode: 201,
                message: 'User registered',
                data: { user: mockUser },
            });
        });

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: /check your email/i })).toBeInTheDocument();
        });
    });
});
