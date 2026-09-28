import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionCard from '@/components/billing/SubscriptionCard';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/hooks/billing/useSubscription');
vi.mock('@/lib/api/client', () => ({
    apiRequest: vi.fn(),
}));

import { useSubscription } from '@/hooks/billing/useSubscription';

describe('SubscriptionCard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders loading state when subscription data is loading', () => {
        vi.mocked(useSubscription).mockReturnValue({
            data: undefined,
            isLoading: true,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useSubscription>);

        render(<SubscriptionCard />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders error state when subscription data fetching fails', () => {
        vi.mocked(useSubscription).mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error('Failed to fetch subscription status'),
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useSubscription>);

        render(<SubscriptionCard />);
        expect(screen.getByText('Failed to load subscription information')).toBeInTheDocument();
    });

    it('renders active subscription state without displaying prices or checkout action', () => {
        vi.mocked(useSubscription).mockReturnValue({
            data: {
                hasAccess: true,
                subscription: {
                    id: 'sub_123',
                    status: 'active',
                    currentPeriodEnd: '2026-12-31T23:59:59Z',
                },
            },
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useSubscription>);

        render(<SubscriptionCard />);

        expect(screen.getByText('Active Subscription')).toBeInTheDocument();
        expect(screen.getByText('active')).toBeInTheDocument();
        // Q-14: Price must never be displayed
        expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
        expect(screen.queryByText(/ETB/i)).not.toBeInTheDocument();
        // No action button when active
        expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
    });

    it('renders unpaid state and hides checkout button for past_due status (Q-15)', () => {
        vi.mocked(useSubscription).mockReturnValue({
            data: {
                hasAccess: false,
                subscription: {
                    id: 'sub_123',
                    status: 'past_due',
                    currentPeriodEnd: '2026-01-01T00:00:00Z',
                },
            },
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useSubscription>);

        render(<SubscriptionCard />);

        expect(screen.getByText('past due')).toBeInTheDocument();
        // Q-15: Never show a subscribe button for past_due_*
        expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
    });

    it('renders unsubscribed state with subscribe action and triggers checkout on click', async () => {
        vi.mocked(useSubscription).mockReturnValue({
            data: {
                hasAccess: false,
                subscription: null,
            },
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useSubscription>);

        vi.mocked(apiRequest).mockResolvedValueOnce({
            data: { checkoutUrl: 'https://checkout.example.com' },
        } as never);

        render(<SubscriptionCard />);

        const subscribeBtn = screen.getByRole('button', { name: /subscribe/i });
        expect(subscribeBtn).toBeInTheDocument();

        fireEvent.click(subscribeBtn);

        await waitFor(() => {
            expect(apiRequest).toHaveBeenCalledWith('POST', '/billing/checkout');
        });
    });

    it('displays subscribeError inline when checkout initialization fails', async () => {
        vi.mocked(useSubscription).mockReturnValue({
            data: {
                hasAccess: false,
                subscription: null,
            },
            isLoading: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useSubscription>);

        vi.mocked(apiRequest).mockRejectedValueOnce(
            new Error('Checkout initialization failed. Please try again.')
        );

        render(<SubscriptionCard />);

        const subscribeBtn = screen.getByRole('button', { name: /subscribe/i });
        fireEvent.click(subscribeBtn);

        expect(
            await screen.findByText('Checkout initialization failed. Please try again.')
        ).toBeInTheDocument();
    });
});