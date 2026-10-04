import { useState } from 'react';
import { Check, CreditCard, Loader2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const planFeatures = [
  'Unlimited assigned tickets each month',
  'Full AI mentor access with guided hints',
  'Rubric-scored feedback on every submission',
  'Experience profile with public work history',
];

function sanitizeErrorMessage(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  if (/^Route\s+[A-Z]+\s+\//i.test(message) || message.includes('/api/')) {
    return fallback;
  }
  return message;
}

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
      const mapped = mapApiError(error);
      if (mapped.message && (/^Route\s+[A-Z]+\s+\//i.test(mapped.message) || mapped.message.includes('/api/'))) {
        mapped.message = 'Failed to start checkout. Please try again.';
      }
      setSubscribeError(mapped);
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
        setCancelError(sanitizeErrorMessage(mappedError.message, 'Failed to cancel subscription. Please try again.'));
      }
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and view payment history.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="font-heading text-lg font-medium">Practitioner plan</CardTitle>
            <CardDescription>450 ETB / month · billed via Chapa</CardDescription>
          </div>
          <span className="font-heading text-3xl font-medium tracking-tight text-nowrap">450 ETB</span>
        </CardHeader>
        <CardContent>
          <div className="mb-5 border-t border-border" />
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {planFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground text-pretty">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-medium">Subscription</CardTitle>
          <CardDescription>Current access and renewal status</CardDescription>
        </CardHeader>
        <CardContent>
          {subscription.isLoading ? (
            <div
              role="status"
              aria-label="Loading subscription"
              className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading subscription…
            </div>
          ) : subscription.isError || !subscription.data ? (
            <ErrorState
              message={sanitizeErrorMessage(subscription.error?.message, 'Failed to load subscription information.')}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="font-heading text-base font-medium">Payment method</CardTitle>
            <CardDescription>Billed via Chapa</CardDescription>
          </div>
          <Button variant="outline" size="sm" type="button" disabled>
            <CreditCard data-icon="inline-start" />
            Update
          </Button>
        </CardHeader>
        <CardContent className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3">
          <CreditCard className="size-5 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Telebirr · via Chapa</span>
            <span className="text-xs text-muted-foreground">Managed on Chapa checkout</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-medium">Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.isLoading ? (
            <div
              role="status"
              aria-label="Loading payment history"
              className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading payments…
            </div>
          ) : payments.isError ? (
            <ErrorState
              message={sanitizeErrorMessage(payments.error?.message, 'Failed to load payment history.')}
              onRetry={() => void payments.refetch()}
              retryLabel="Retry payments"
            />
          ) : (
            <PaymentHistory payments={payments.data ?? []} />
          )}
        </CardContent>
      </Card>

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
