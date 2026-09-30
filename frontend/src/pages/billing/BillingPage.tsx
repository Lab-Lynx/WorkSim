import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { usePayments } from '@/hooks/billing/usePayments';
import { useStartCheckout } from '@/hooks/billing/useStartCheckout';
import { useCancelSubscription } from '@/hooks/billing/useCancelSubscription';
import { mapApiError } from '@/lib/api/errors';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import ErrorState from '@/components/common/ErrorState';
import SubscriptionCard from '@/components/billing/SubscriptionCard';
import PaymentHistory from '@/components/billing/PaymentHistory';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function BillingPage() {
  useDocumentTitle('Billing');

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [subscribeError, setSubscribeError] = useState<ReturnType<typeof mapApiError> | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const subscription = useSubscription();
  const payments = usePayments();
  const checkout = useStartCheckout();
  const cancel = useCancelSubscription();

  const handleSubscribe = async () => {
    setIsRedirecting(true);
    setSubscribeError(null);
    try {
      const { checkoutUrl } = await checkout.mutateAsync();
      window.location.assign(checkoutUrl);
    } catch (error: unknown) {
      setIsRedirecting(false);
      setSubscribeError(mapApiError(error));
    }
  };

  const handleConfirmCancel = async () => {
    setCancelError(null);
    try {
      await cancel.mutateAsync();
      setIsConfirmOpen(false);
    } catch (error: unknown) {
      const mappedError = mapApiError(error);
      if (mappedError.status === 409) {
        setIsConfirmOpen(false);
      } else {
        setCancelError(mappedError.message);
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="subscription-heading" className="flex flex-col gap-3">
          <h2 id="subscription-heading" className="text-lg font-semibold">Subscription</h2>
          {subscription.isLoading ? (
            <div role="status" aria-label="Loading subscription" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading subscription…
            </div>
          ) : subscription.isError || !subscription.data ? (
            <ErrorState
              message={subscription.error?.message || 'Failed to load subscription information.'}
              onRetry={() => void subscription.refetch()}
              retryLabel="Retry subscription"
            />
          ) : (
            <SubscriptionCard
              data={subscription.data}
              isSubscribing={checkout.isPending || isRedirecting}
              subscribeError={subscribeError}
              onSubscribe={() => void handleSubscribe()}
              onCancelClick={() => {
                setCancelError(null);
                setIsConfirmOpen(true);
              }}
            />
          )}
        </section>

        <section aria-labelledby="payments-heading" className="flex flex-col gap-3">
          <h2 id="payments-heading" className="text-lg font-semibold">Payment history</h2>
          {payments.isLoading ? (
            <div role="status" aria-label="Loading payment history" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading payments…
            </div>
          ) : payments.isError ? (
            <ErrorState
              message={payments.error?.message || 'Failed to load payment history.'}
              onRetry={() => void payments.refetch()}
              retryLabel="Retry payments"
            />
          ) : (
            <PaymentHistory payments={payments.data ?? []} />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={(open) => {
          setIsConfirmOpen(open);
          if (!open) setCancelError(null);
        }}
        title="Cancel Subscription?"
        description="Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period."
        confirmLabel="Confirm Cancellation"
        cancelLabel="Keep Subscription"
        destructive
        onConfirm={() => void handleConfirmCancel()}
        isPending={cancel.isPending}
        errorMessage={cancelError}
      />
    </div>
  );
}

export default BillingPage;