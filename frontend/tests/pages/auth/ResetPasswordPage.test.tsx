import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import * as useResetPasswordModule from '@/hooks/auth/useResetPassword';
import { ApiError } from '@/lib/api/errors';

vi.mock('@/hooks/auth/useResetPassword');

const mockMutateAsync = vi.fn();

describe('ResetPasswordPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useResetPasswordModule.useResetPassword).mockReturnValue({
            mutateAsync: mockMutateAsync,
            isPending: false,
        } as unknown as ReturnType<typeof useResetPasswordModule.useResetPassword>);
    });

    const renderComponent = (initialEntries = ['/reset-password?token=valid-token']) => {
        return render(
            <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/login" element={<div>Login Page</div>} />
                    <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
                </Routes>
            </MemoryRouter>
        );
    };

    it('renders invalid link state when token query parameter is missing', () => {
        renderComponent(['/reset-password']);

        expect(screen.getByRole('heading', { name: /invalid or expired link/i })).toBeInTheDocument();
        expect(screen.getByText(/this password reset link is invalid or has expired/i)).toBeInTheDocument();

        const requestLink = screen.getByRole('link', { name: /request a new link/i });
        expect(requestLink).toBeInTheDocument();
        expect(requestLink).toHaveAttribute('href', '/forgot-password');
    });

    it('renders the password reset form when token query parameter is present', () => {
        renderComponent();

        expect(screen.getByRole('heading', { name: /reset password/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });

    it('validates password requirements', async () => {
        renderComponent();

        fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: 'short' } });
        fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

        expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
        expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('submits form with token and navigates to login on success with password_reset notice', async () => {
        mockMutateAsync.mockResolvedValueOnce({});
        renderComponent();

        fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: 'newPassword123' } });
        fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

        await waitFor(() => {
            expect(mockMutateAsync).toHaveBeenCalledWith({
                token: 'valid-token',
                newPassword: 'newPassword123',
            });
        });

        expect(await screen.findByText('Login Page')).toBeInTheDocument();
    });

    it('displays invalid link view when submission returns a 410 error', async () => {
        const error410 = new ApiError(410, 'Token has expired', 'api');
        mockMutateAsync.mockRejectedValueOnce(error410);

        renderComponent();

        fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: 'newPassword123' } });
        fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

        expect(await screen.findByRole('heading', { name: /invalid or expired link/i })).toBeInTheDocument();
    });

    it('displays invalid link view when submission returns a 400 Invalid reset link error', async () => {
        const error400 = new ApiError(400, 'Invalid reset link', 'api');
        mockMutateAsync.mockRejectedValueOnce(error400);

        renderComponent();

        fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: 'newPassword123' } });
        fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

        expect(await screen.findByRole('heading', { name: /invalid or expired link/i })).toBeInTheDocument();
        expect(screen.getByText(/this password reset link is invalid or has expired/i)).toBeInTheDocument();
    });
});