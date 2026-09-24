import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Virtual mocks for unimplemented hooks
const mockUseMe = vi.fn();
const mockUseResendVerification = vi.fn();

vi.mock('../../../src/hooks/auth/useMe', () => ({
    useMe: () => mockUseMe(),
}));

vi.mock('../../../src/hooks/auth/useResendVerification', () => ({
    useResendVerification: () => mockUseResendVerification(),
}));

import { EmailVerificationBanner } from '../../../src/components/layout/EmailVerificationBanner';

describe('EmailVerificationBanner', () => {
    const mockResend = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseResendVerification.mockReturnValue({
            resend: mockResend,
            isPending: false,
            cooldownSeconds: 0,
            isCoolingDown: false,
            error: null,
            message: null,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders nothing when user is verified or user state is loading/absent', () => {
        // Verified user
        mockUseMe.mockReturnValue({
            data: { id: '1', email: 'user@example.com', emailVerifiedAt: '2026-01-01T00:00:00Z' },
            isLoading: false,
        });

        const { container, rerender } = render(<EmailVerificationBanner />);
        expect(container).toBeEmptyDOMElement();

        // Unauthenticated/Null user
        mockUseMe.mockReturnValue({
            data: null,
            isLoading: false,
        });

        rerender(<EmailVerificationBanner />);
        expect(container).toBeEmptyDOMElement();

        // Loading state
        mockUseMe.mockReturnValue({
            data: null,
            isLoading: true,
        });

        rerender(<EmailVerificationBanner />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the verification banner when email is not verified', () => {
        mockUseMe.mockReturnValue({
            data: { id: '1', email: 'unverified@example.com', emailVerifiedAt: null },
            isLoading: false,
        });

        render(<EmailVerificationBanner />);

        expect(screen.getByRole('region', { name: /email verification/i })).toBeInTheDocument();
        expect(screen.getByText(/please verify your email/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument();
    });

    it('calls resend with user email when resend button is clicked', () => {
        mockUseMe.mockReturnValue({
            data: { id: '1', email: 'unverified@example.com', emailVerifiedAt: null },
            isLoading: false,
        });

        render(<EmailVerificationBanner />);

        const resendBtn = screen.getByRole('button', { name: /resend/i });
        fireEvent.click(resendBtn);

        expect(mockResend).toHaveBeenCalledWith('unverified@example.com');
    });

    it('disables the resend button when action is pending or in cooldown', () => {
        mockUseMe.mockReturnValue({
            data: { id: '1', email: 'unverified@example.com', emailVerifiedAt: null },
            isLoading: false,
        });

        // Pending state
        mockUseResendVerification.mockReturnValue({
            resend: mockResend,
            isPending: true,
            cooldownSeconds: 0,
            isCoolingDown: false,
            error: null,
            message: null,
        });

        const { rerender } = render(<EmailVerificationBanner />);
        let resendBtn = screen.getByRole('button');
        expect(resendBtn).toBeDisabled();

        // Cooldown state
        mockUseResendVerification.mockReturnValue({
            resend: mockResend,
            isPending: false,
            cooldownSeconds: 45,
            isCoolingDown: true,
            error: null,
            message: null,
        });

        rerender(<EmailVerificationBanner />);
        resendBtn = screen.getByRole('button');
        expect(resendBtn).toBeDisabled();
        expect(resendBtn).toHaveTextContent(/45/);
    });

    it('is non-dismissible and contains no close/dismiss controls', () => {
        mockUseMe.mockReturnValue({
            data: { id: '1', email: 'unverified@example.com', emailVerifiedAt: null },
            isLoading: false,
        });

        render(<EmailVerificationBanner />);

        expect(screen.queryByRole('button', { name: /close|dismiss/i })).not.toBeInTheDocument();
    });

    it('displays error or success messages from useResendVerification', () => {
        mockUseMe.mockReturnValue({
            data: { id: '1', email: 'unverified@example.com', emailVerifiedAt: null },
            isLoading: false,
        });

        mockUseResendVerification.mockReturnValue({
            resend: mockResend,
            isPending: false,
            cooldownSeconds: 0,
            isCoolingDown: false,
            error: { message: 'Failed to send verification link.' },
            message: null,
        });

        const { rerender } = render(<EmailVerificationBanner />);
        expect(screen.getByText('Failed to send verification link.')).toBeInTheDocument();

        mockUseResendVerification.mockReturnValue({
            resend: mockResend,
            isPending: false,
            cooldownSeconds: 0,
            isCoolingDown: false,
            error: null,
            message: 'Verification link sent successfully.',
        });

        rerender(<EmailVerificationBanner />);
        expect(screen.getByText('Verification link sent successfully.')).toBeInTheDocument();
    });
});