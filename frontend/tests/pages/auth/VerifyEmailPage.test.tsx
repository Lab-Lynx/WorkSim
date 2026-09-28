import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import * as useVerifyEmailModule from '@/hooks/auth/useVerifyEmail';
import * as useResendVerificationModule from '@/hooks/auth/useResendVerification';
import * as useMeModule from '@/hooks/auth/useMe';

vi.mock('@/hooks/auth/useVerifyEmail');
vi.mock('@/hooks/auth/useResendVerification');
vi.mock('@/hooks/auth/useMe');

describe('VerifyEmailPage (FE-071)', () => {
    let queryClient: QueryClient;

    const mockMutateAsync = vi.fn();
    const mockResend = vi.fn();

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });

        vi.clearAllMocks();

        vi.spyOn(useVerifyEmailModule, 'useVerifyEmail').mockReturnValue({
            mutateAsync: mockMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            error: null,
            data: undefined,
        } as unknown as ReturnType<typeof useVerifyEmailModule.useVerifyEmail>);

        vi.spyOn(useResendVerificationModule, 'useResendVerification').mockReturnValue({
            resend: mockResend,
            isPending: false,
            isCoolingDown: false,
            cooldownSecondsLeft: 0,
            cooldownSeconds: 0,
            message: null,
            error: null,
        });

        vi.spyOn(useMeModule, 'useMe').mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: false,
        } as unknown as ReturnType<typeof useMeModule.useMe>);
    });

    afterEach(() => {
        queryClient.clear();
    });

    const renderComponent = (initialEntries = ['/verify-email']) => {
        return render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={initialEntries}>
                    <Routes>
                        <Route path="/verify-email" element={<VerifyEmailPage />} />
                        <Route path="/login" element={<div>Login Page</div>} />
                        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );
    };

    it('renders instructions and email resend form when no token is present in search parameters', () => {
        renderComponent(['/verify-email?email=test@example.com']);

        expect(screen.getByRole('heading', { level: 1, name: /verify your email/i })).toBeInTheDocument();
        expect(screen.getByText(/we've sent a verification link/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/email address/i)).toHaveValue('test@example.com');
    });

    it('triggers verification mutation on mount when token search parameter exists', async () => {
        mockMutateAsync.mockResolvedValueOnce({ emailVerifiedAt: '2026-09-28T23:00:00Z' });

        renderComponent(['/verify-email?token=valid-token']);

        await waitFor(() => {
            expect(mockMutateAsync).toHaveBeenCalledTimes(1);
            expect(mockMutateAsync).toHaveBeenCalledWith({ token: 'valid-token' });
        });
    });

    it('ensures single-flight execution and prevents duplicate verification calls for the same token', async () => {
        mockMutateAsync.mockResolvedValueOnce({ emailVerifiedAt: '2026-09-28T23:00:00Z' });

        const { rerender } = renderComponent(['/verify-email?token=same-token']);

        rerender(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/verify-email?token=same-token']}>
                    <Routes>
                        <Route path="/verify-email" element={<VerifyEmailPage />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        );

        await waitFor(() => {
            expect(mockMutateAsync).toHaveBeenCalledTimes(1);
        });
    });

    it('prefills email input from search parameter or logged in user details', () => {
        vi.spyOn(useMeModule, 'useMe').mockReturnValue({
            data: { id: '1', email: 'user@domain.com', name: 'User' },
            isLoading: false,
        } as unknown as ReturnType<typeof useMeModule.useMe>);

        renderComponent(['/verify-email']);

        expect(screen.getByLabelText(/email address/i)).toHaveValue('user@domain.com');
    });

    it('displays error message and allows manual resend on verification failure', async () => {
        mockMutateAsync.mockRejectedValueOnce({
            message: 'Invalid or expired verification token.',
        });

        renderComponent(['/verify-email?token=invalid-token&email=user@test.com']);

        await waitFor(() => {
            expect(screen.getByText(/invalid or expired verification token/i)).toBeInTheDocument();
        });

        const emailInput = screen.getByLabelText(/email address/i);
        const resendButton = screen.getByRole('button', { name: /resend verification email/i });

        expect(emailInput).toHaveValue('user@test.com');
        expect(resendButton).toBeEnabled();

        fireEvent.click(resendButton);

        await waitFor(() => {
            expect(mockResend).toHaveBeenCalledWith('user@test.com');
        });
    });

    it('handles D-11 soft-success response gracefully when email is already verified', async () => {
        mockMutateAsync.mockResolvedValueOnce({
            emailVerifiedAt: '2026-01-01T00:00:00.000Z',
        });

        renderComponent(['/verify-email?token=already-used-token']);

        await waitFor(() => {
            expect(screen.getByRole('heading', { level: 1, name: /email verified/i })).toBeInTheDocument();
            expect(screen.getByText(/your email address has been verified successfully/i)).toBeInTheDocument();
        });
    });

    it('disables resend button during active cooldown', () => {
        vi.spyOn(useResendVerificationModule, 'useResendVerification').mockReturnValue({
            resend: mockResend,
            isPending: false,
            isCoolingDown: true,
            cooldownSecondsLeft: 45,
            cooldownSeconds: 45,
            message: null,
            error: null,
        });

        renderComponent(['/verify-email?email=test@example.com']);

        const resendButton = screen.getByRole('button', { name: /resend in 45s/i });
        expect(resendButton).toBeDisabled();
    });
});