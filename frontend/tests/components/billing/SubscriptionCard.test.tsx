import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubscriptionCard from '@/components/billing/SubscriptionCard';
import type { UiError } from '@/lib/api/errors';
import type { SubscriptionStatusResponse } from '@/types';

const baseProps = {
    data: { subscription: null, hasAccess: false } satisfies SubscriptionStatusResponse,
    isSubscribing: false,
    subscribeError: null as UiError | null,
    onSubscribe: vi.fn(),
    onCancelClick: vi.fn(),
};

describe('SubscriptionCard (FE-073)', () => {
    it('renders from parent data and delegates checkout without making an HTTP request', () => {
        const onSubscribe = vi.fn();
        render(<SubscriptionCard {...baseProps} onSubscribe={onSubscribe} />);

        expect(screen.getAllByText('Not subscribed')).toHaveLength(2);
        fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
        expect(onSubscribe).toHaveBeenCalledOnce();
    });

    it('renders active subscription state without displaying prices or checkout action', () => {
        render(
            <SubscriptionCard
                {...baseProps}
                data={{
                    hasAccess: true,
                    subscription: {
                        id: 'sub_123',
                        status: 'active',
                        currentPeriodEnd: '2026-12-31T23:59:59Z',
                        canceledAt: null,
                    },
                }}
            />
        );

        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Next billing date: 31 Dec 2026')).toBeInTheDocument();
        expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
        expect(screen.queryByText(/ETB/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
    });

    it('never shows an action for past_due subscriptions', () => {
        render(
            <SubscriptionCard
                {...baseProps}
                data={{
                    hasAccess: false,
                    subscription: {
                        id: 'sub_123',
                        status: 'past_due',
                        currentPeriodEnd: '2026-12-31T23:59:59Z',
                        canceledAt: null,
                    },
                }}
            />
        );

        expect(screen.getByText('Payment failed')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('keeps subscribe disabled until checkout unload and shows Chapa guidance', () => {
        render(<SubscriptionCard {...baseProps} isSubscribing />);

        expect(screen.getByRole('button', { name: /opening chapa/i })).toBeDisabled();
        expect(screen.getByText(/work simulator never sees your card details/i)).toBeInTheDocument();
    });

    it('renders the mapped subscribe error inline', () => {
        render(
            <SubscriptionCard
                {...baseProps}
                subscribeError={{
                    status: 500,
                    kind: 'api',
                    message: 'Checkout is temporarily unavailable.',
                    action: 'retry',
                    isNotFound: false,
                    isTimeout: false,
                }}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Checkout is temporarily unavailable.');
    });

    it('delegates cancellation from the active subscription action', () => {
        const onCancelClick = vi.fn();
        render(
            <SubscriptionCard
                {...baseProps}
                data={{
                    hasAccess: true,
                    subscription: {
                        id: 'sub_123',
                        status: 'active',
                        currentPeriodEnd: '2026-12-31T23:59:59Z',
                        canceledAt: null,
                    },
                }}
                onCancelClick={onCancelClick}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /cancel subscription/i }));
        expect(onCancelClick).toHaveBeenCalledOnce();
    });
});