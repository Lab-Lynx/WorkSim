import React, { useState } from 'react';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { apiRequest } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import ErrorState from '@/components/common/ErrorState';
import SubmitButton from '@/components/common/SubmitButton';

interface CheckoutResponse {
    checkoutUrl?: string;
}

export default function SubscriptionCard(): React.JSX.Element {
    const { data: subscriptionData, isLoading, error, refetch } = useSubscription();

    const [isSubscribing, setIsSubscribing] = useState(false);
    const [subscribeError, setSubscribeError] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div
                role="status"
                aria-label="Loading subscription details"
                className="p-6 text-center text-sm text-text-muted rounded-xl border border-border bg-surface"
            >
                Loading subscription information…
            </div>
        );
    }

    if (error) {
        return (
            <ErrorState
                message="Failed to load subscription information"
                onRetry={() => void refetch()}
            />
        );
    }

    // Extract subscription attributes safely
    const subscription = subscriptionData?.subscription;
    const status = subscription?.status ?? 'none';
    const currentPeriodEnd = subscription?.currentPeriodEnd;
    const hasAccess = subscriptionData?.hasAccess ?? false;

    // Q-15: Never show a checkout button for active or past_due statuses
    const isPastDue = status.startsWith('past_due');
    const canSubscribe = !hasAccess && !isPastDue && status !== 'active';

    const handleSubscribe = async () => {
        try {
            setIsSubscribing(true);
            setSubscribeError(null);

            // Trigger checkout / subscribe endpoint
            const response = await apiRequest<CheckoutResponse>('POST', '/billing/checkout');

            if (response.data?.checkoutUrl) {
                window.location.href = response.data.checkoutUrl;
            }
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Checkout initialization failed. Please try again.';
            setSubscribeError(message);
            setIsSubscribing(false);
        }
    };

    return (
        <section
            aria-label="Current Subscription"
            className="p-6 rounded-xl border border-border bg-surface shadow-xs flex flex-col gap-4"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground tracking-tight">
                        {hasAccess ? 'Active Subscription' : 'No Active Plan'}
                    </h2>
                    {currentPeriodEnd && (
                        <p className="text-xs text-text-muted mt-0.5">
                            Renews / Ends on {formatDate(currentPeriodEnd)}
                        </p>
                    )}
                </div>

                {/* Status Badge Tag */}
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${hasAccess
                            ? 'bg-status-in-progress-bg text-status-in-progress-text'
                            : 'bg-muted text-text-muted'
                        }`}
                >
                    {status.replace('_', ' ')}
                </span>
            </div>

            {/* Inline Subscribe Error */}
            {subscribeError && (
                <div
                    role="alert"
                    className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium"
                >
                    {subscribeError}
                </div>
            )}

            {/* Single Action: Subscribe Button (Never displays price per Q-14) */}
            {canSubscribe && (
                <div className="pt-2 border-t border-border flex justify-end">
                    <SubmitButton
                        type="button"
                        isPending={isSubscribing}
                        pendingLabel="Subscribing…"
                        onClick={() => void handleSubscribe()}
                        className="w-full sm:w-auto min-w-[140px]"
                    >
                        Subscribe
                    </SubmitButton>
                </div>
            )}
        </section>
    );
}