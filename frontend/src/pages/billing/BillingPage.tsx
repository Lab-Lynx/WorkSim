import React, { useState } from 'react';
import { Loader2, AlertTriangle, ShieldCheck, CreditCard } from 'lucide-react';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { usePayments } from '@/hooks/billing/usePayments';
import { useStartCheckout } from '@/hooks/billing/useStartCheckout';
import { useCancelSubscription } from '@/hooks/billing/useCancelSubscription';
import { getSubscriptionView, type SubscriptionViewKind } from '@/lib/subscription-view';
import { formatDate, formatAmount } from '@/lib/format';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import ErrorState from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';

export function BillingPage(): React.JSX.Element {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const {
        data: subData,
        isLoading: isSubLoading,
        isError: isSubError,
        error: subError,
        refetch: refetchSub,
    } = useSubscription();

    const {
        data: payments,
        isLoading: isPaymentsLoading,
        isError: isPaymentsError,
        error: paymentsError,
        refetch: refetchPayments,
    } = usePayments();

    const checkoutMutation = useStartCheckout({
        onSuccess: (data) => {
            window.location.href = data.checkoutUrl;
        },
    });

    const cancelMutation = useCancelSubscription({
        onSuccess: () => {
            setIsConfirmOpen(false);
        },
    });

    const isLoading = isSubLoading || isPaymentsLoading;

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] w-full items-center justify-center p-6" data-testid="billing-loading">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading billing information" />
            </div>
        );
    }

    if (isSubError || isPaymentsError) {
        const errorMessage =
            subError?.message || paymentsError?.message || 'Failed to load billing information. Please try again.';

        const handleRetryAll = () => {
            if (isSubError) refetchSub();
            if (isPaymentsError) refetchPayments();
        };

        return (
            <div className="container max-w-4xl py-8">
                <ErrorState message={errorMessage} onRetry={handleRetryAll} retryLabel="Retry Loading" />
            </div>
        );
    }

    const subView = subData
        ? getSubscriptionView(subData)
        : {
            kind: 'unknown' as SubscriptionViewKind,
            periodEnd: null,
            primaryAction: null,
            showsBanner: false,
        };

    const handleSubscribe = () => {
        checkoutMutation.mutate();
    };

    const handleConfirmCancel = () => {
        cancelMutation.mutate();
    };

    const renderStatusBadge = (kind: SubscriptionViewKind) => {
        switch (kind) {
            case 'active':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Active
                    </span>
                );
            case 'renewal_pending':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                        Renewal Pending
                    </span>
                );
            case 'past_due_access':
            case 'past_due_ended':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive">
                        Past Due
                    </span>
                );
            case 'canceled_access':
            case 'ended':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-text-muted">
                        Canceled
                    </span>
                );
            case 'never':
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-text-muted">
                        No Subscription
                    </span>
                );
        }
    };

    return (
        <div className="container max-w-4xl space-y-8 py-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-text-heading">Billing & Subscription</h1>
                <p className="text-sm text-text-muted">Manage your plan subscription and review billing history.</p>
            </div>

            {subView.showsBanner && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-300"
                >
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <div className="text-sm">
                        <p className="font-semibold">Subscription Status Alert</p>
                        <p className="mt-0.5">
                            {subView.kind === 'past_due_access' &&
                                'Your payment is past due. Access remains active, but please update your payment method to ensure uninterrupted service.'}
                            {subView.kind === 'past_due_ended' &&
                                'Your payment is past due and access has been suspended. Please subscribe to restore access.'}
                            {subView.kind === 'canceled_access' &&
                                `Your subscription has been canceled. You still have access until ${formatDate(
                                    subView.periodEnd
                                )}.`}
                            {subView.kind === 'ended' &&
                                'Your subscription period has ended. Subscribe below to reactivate your membership.'}
                        </p>
                    </div>
                </div>
            )}

            {/* Subscription Card */}
            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-text-heading">Current Plan</h2>
                            {renderStatusBadge(subView.kind)}
                        </div>
                        {subView.periodEnd && (
                            <p className="text-sm text-text-muted">
                                {subView.kind === 'active' ? 'Renews on' : 'Access expires on'} {formatDate(subView.periodEnd)}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {subView.primaryAction === 'subscribe' && (
                            <Button
                                onClick={handleSubscribe}
                                disabled={checkoutMutation.isPending}
                                className="w-full sm:w-auto"
                            >
                                {checkoutMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                )}
                                Subscribe Now
                            </Button>
                        )}

                        {subView.primaryAction === 'cancel' && (
                            <Button
                                variant="outline"
                                onClick={() => setIsConfirmOpen(true)}
                                className="w-full sm:w-auto text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            >
                                Cancel Subscription
                            </Button>
                        )}
                    </div>
                </div>

                {checkoutMutation.isError && (
                    <div className="mt-4">
                        <ErrorState
                            message={checkoutMutation.error?.message || 'Failed to initiate checkout process.'}
                        />
                    </div>
                )}
            </section>

            {/* Payment History Section */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-text-heading">Payment History</h2>
                </div>

                {!payments || payments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center">
                        <CreditCard className="h-10 w-10 text-text-muted mb-2" />
                        <p className="text-sm font-medium text-text-heading">No payment history</p>
                        <p className="text-xs text-text-muted">Invoices and payment receipts will appear here.</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-border bg-muted/50 text-xs text-text-muted uppercase tracking-wider">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 font-medium">
                                            Date
                                        </th>
                                        <th scope="col" className="px-6 py-3 font-medium">
                                            Amount
                                        </th>
                                        <th scope="col" className="px-6 py-3 font-medium">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {payments.map((payment) => (
                                        <tr key={payment.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 font-medium text-text-heading">
                                                {formatDate(payment.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 text-text-muted">
                                                {formatAmount(payment.amount, payment.currency)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="capitalize text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                    {payment.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>

            {/* Confirm Cancellation Dialog */}
            <ConfirmDialog
                open={isConfirmOpen}
                onOpenChange={setIsConfirmOpen}
                title="Cancel Subscription?"
                description="Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period."
                confirmLabel="Confirm Cancellation"
                cancelLabel="Keep Subscription"
                destructive
                onConfirm={handleConfirmCancel}
                isPending={cancelMutation.isPending}
                errorMessage={cancelMutation.error?.message}
            />
        </div>
    );
}