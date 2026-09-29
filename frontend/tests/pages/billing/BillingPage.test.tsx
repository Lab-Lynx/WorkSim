import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingPage } from '@/pages/billing/BillingPage';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { usePayments } from '@/hooks/billing/usePayments';
import { useStartCheckout } from '@/hooks/billing/useStartCheckout';
import { useCancelSubscription } from '@/hooks/billing/useCancelSubscription';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import type { SubscriptionStatusResponse, Payment, Subscription } from '@/types';
import type { StartCheckoutResponse } from '@/hooks/billing/useStartCheckout';
import type { ApiError } from '@/lib/api/errors';

vi.mock('@/hooks/billing/useSubscription');
vi.mock('@/hooks/billing/usePayments');
vi.mock('@/hooks/billing/useStartCheckout');
vi.mock('@/hooks/billing/useCancelSubscription');

const mockUseSubscription = vi.mocked(useSubscription);
const mockUsePayments = vi.mocked(usePayments);
const mockUseStartCheckout = vi.mocked(useStartCheckout);
const mockUseCancelSubscription = vi.mocked(useCancelSubscription);

describe('BillingPage', () => {
    const mockMutateCheckout = vi.fn();
    const mockMutateCancel = vi.fn();
    const mockRefetchSub = vi.fn();
    const mockRefetchPayments = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseSubscription.mockReturnValue({
            data: {
                subscription: null,
                hasAccess: false,
            },
            isLoading: false,
            isError: false,
            error: null,
            refetch: mockRefetchSub,
        } as unknown as UseQueryResult<SubscriptionStatusResponse, ApiError>);

        mockUsePayments.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
            error: null,
            refetch: mockRefetchPayments,
        } as unknown as UseQueryResult<Payment[], ApiError>);

        mockUseStartCheckout.mockReturnValue({
            mutate: mockMutateCheckout,
            isPending: false,
            isError: false,
            error: null,
        } as unknown as UseMutationResult<StartCheckoutResponse, ApiError, void>);

        mockUseCancelSubscription.mockReturnValue({
            mutate: mockMutateCancel,
            isPending: false,
            isError: false,
            error: null,
        } as unknown as UseMutationResult<Subscription, ApiError, void>);
    });

    it('renders loading indicator when fetching subscription or payments', () => {
        mockUseSubscription.mockReturnValueOnce({
            isLoading: true,
        } as unknown as UseQueryResult<SubscriptionStatusResponse, ApiError>);

        render(<BillingPage />);
        expect(screen.getByTestId('billing-loading')).toBeInTheDocument();
    });

    it('renders error state and retry button if queries fail', () => {
        mockUseSubscription.mockReturnValueOnce({
            isLoading: false,
            isError: true,
            error: { message: 'Failed to load subscription' } as ApiError,
            refetch: mockRefetchSub,
        } as unknown as UseQueryResult<SubscriptionStatusResponse, ApiError>);

        render(<BillingPage />);

        expect(screen.getByRole('alert')).toHaveTextContent('Failed to load subscription');

        const retryBtn = screen.getByRole('button', { name: /retry loading/i });
        fireEvent.click(retryBtn);
        expect(mockRefetchSub).toHaveBeenCalledTimes(1);
    });

    it('renders "Subscribe Now" button when user has no active subscription', () => {
        render(<BillingPage />);

        const subscribeBtn = screen.getByRole('button', { name: /subscribe now/i });
        expect(subscribeBtn).toBeInTheDocument();

        fireEvent.click(subscribeBtn);
        expect(mockMutateCheckout).toHaveBeenCalledTimes(1);
    });

    it('renders "Cancel Subscription" button when subscription is active', () => {
        mockUseSubscription.mockReturnValue({
            data: {
                subscription: {
                    id: 'sub-1',
                    status: 'active',
                    currentPeriodEnd: '2026-10-01T00:00:00.000Z',
                },
                hasAccess: true,
            },
            isLoading: false,
            isError: false,
            error: null,
        } as unknown as UseQueryResult<SubscriptionStatusResponse, ApiError>);

        render(<BillingPage />);

        expect(screen.getByText(/active/i)).toBeInTheDocument();
        expect(screen.getByText(/renews on 1 Oct 2026/i)).toBeInTheDocument();

        const cancelBtn = screen.getByRole('button', { name: /cancel subscription/i });
        expect(cancelBtn).toBeInTheDocument();

        fireEvent.click(cancelBtn);

        // Confirmation dialog should appear
        expect(screen.getByText('Cancel Subscription?')).toBeInTheDocument();

        const confirmBtn = screen.getByRole('button', { name: /confirm cancellation/i });
        fireEvent.click(confirmBtn);

        expect(mockMutateCancel).toHaveBeenCalledTimes(1);
    });

    it('renders warning banner for past_due or canceled status', () => {
        mockUseSubscription.mockReturnValue({
            data: {
                subscription: {
                    id: 'sub-1',
                    status: 'canceled',
                    currentPeriodEnd: '2026-10-01T00:00:00.000Z',
                },
                hasAccess: true,
            },
            isLoading: false,
            isError: false,
            error: null,
        } as unknown as UseQueryResult<SubscriptionStatusResponse, ApiError>);

        render(<BillingPage />);

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Your subscription has been canceled. You still have access until 1 Oct 2026.'
        );
    });

    it('renders payment history table when payments are present', () => {
        const mockPaymentsList: Payment[] = [
            {
                id: 'pay-1',
                amount: '29.99',
                currency: 'USD',
                status: 'succeeded',
                createdAt: '2026-09-01T12:00:00.000Z',
                paidAt: '2026-09-01T12:00:00.000Z',
            },
        ];

        mockUsePayments.mockReturnValue({
            data: mockPaymentsList,
            isLoading: false,
            isError: false,
            error: null,
        } as unknown as UseQueryResult<Payment[], ApiError>);

        render(<BillingPage />);

        expect(screen.getByText('29.99 USD')).toBeInTheDocument();
        expect(screen.getByText('succeeded')).toBeInTheDocument();
    });
});