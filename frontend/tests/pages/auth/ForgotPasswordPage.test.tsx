import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import * as useForgotPasswordModule from '@/hooks/auth/useForgotPassword';

// Mock hooks and document title
vi.mock('@/hooks/useDocumentTitle', () => ({
    useDocumentTitle: vi.fn(),
}));

vi.mock('@/hooks/auth/useForgotPassword');

describe('ForgotPasswordPage', () => {
    const mockMutateAsync = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useForgotPasswordModule.useForgotPassword).mockReturnValue({
            mutateAsync: mockMutateAsync,
            isPending: false,
        } as unknown as ReturnType<typeof useForgotPasswordModule.useForgotPassword>);
    });

    const renderComponent = () => {
        return render(
            <MemoryRouter>
                <ForgotPasswordPage />
            </MemoryRouter>
        );
    };

    it('renders the initial forgot password form', () => {
        renderComponent();

        expect(screen.getByRole('heading', { level: 1, name: /forgot password/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /back to log in/i })).toHaveAttribute('href', '/login');
    });

    it('shows client-side validation error when submitting invalid email', async () => {
        renderComponent();

        const emailInput = screen.getByLabelText(/email/i);
        fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
        fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

        expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
        expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('submits form successfully and displays exact server response message', async () => {
        const serverResponseMessage =
            'If an account with that email exists, we have sent a password reset link.';
        mockMutateAsync.mockResolvedValueOnce({ message: serverResponseMessage });

        renderComponent();

        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

        await waitFor(() => {
            expect(mockMutateAsync).toHaveBeenCalledWith({ email: 'user@example.com' });
        });

        // Verify success view rendering
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText(serverResponseMessage)).toBeInTheDocument();
        expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /back to log in/i })).toBeInTheDocument();
    });

    it('handles server side error using applyServerErrorToForm', async () => {
        const mockApiError = {
            status: 400,
            message: 'Unable to process request',
        };
        mockMutateAsync.mockRejectedValueOnce(mockApiError);

        renderComponent();

        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

        await waitFor(() => {
            expect(mockMutateAsync).toHaveBeenCalled();
        });

        // Form should stay rendered with the error message
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });
});