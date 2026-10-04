import React from 'react';
import { getSubscriptionView } from '@/lib/subscription-view';
import { formatDate } from '@/lib/format';
import StatusBadge from '@/components/common/StatusBadge';
import SubmitButton from '@/components/common/SubmitButton';
import { Button } from '@/components/ui/button';
import type { UiError } from '@/lib/api/errors';
import type { SubscriptionStatusResponse } from '@/types';

export interface SubscriptionCardProps {
  data: SubscriptionStatusResponse;
  isSubscribing: boolean;
  subscribeError: UiError | null;
  onSubscribe: () => void;
  onCancelClick: () => void;
}

export default function SubscriptionCard({
  data,
  isSubscribing,
  subscribeError,
  onSubscribe,
  onCancelClick,
}: SubscriptionCardProps): React.JSX.Element {
  const view = getSubscriptionView(data);
  const statusText: Record<string, string | null> = {
    never: 'Not subscribed',
    active: view.periodEnd ? `Next billing date: ${formatDate(view.periodEnd)}` : null,
    renewal_pending: view.periodEnd
      ? `Your billing period ended ${formatDate(view.periodEnd)}. Waiting for Chapa to confirm the renewal.`
      : 'Waiting for Chapa to confirm the renewal.',
    past_due_access: view.periodEnd
      ? `Payment failed. Your access ends ${formatDate(view.periodEnd)}.`
      : 'Payment failed. Your access ends soon.',
    past_due_ended: 'Payment failed. Your access has ended.',
    canceled_access: view.periodEnd ? `Access ends ${formatDate(view.periodEnd)}.` : 'Access is ending.',
    ended: view.periodEnd ? `Subscription ended ${formatDate(view.periodEnd)}.` : 'Subscription ended.',
    unknown: null,
  };

  return (
    <section aria-label="Current Subscription" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge domain="subscription" kind={view.kind} />
        {view.primaryAction === 'subscribe' ? (
          <SubmitButton
            type="button"
            isPending={isSubscribing}
            pendingLabel="Opening Chapa…"
            onClick={onSubscribe}
          >
            Subscribe
          </SubmitButton>
        ) : view.primaryAction === 'cancel' ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onCancelClick}
          >
            Cancel subscription
          </Button>
        ) : null}
      </div>

      {statusText[view.kind] && (
        <p className="text-sm text-muted-foreground">{statusText[view.kind]}</p>
      )}
      {view.primaryAction === 'subscribe' && (
        <p className="text-xs text-muted-foreground">
          You&apos;ll pay on Chapa&apos;s secure page. Work Simulator never sees your card details.
        </p>
      )}
      {subscribeError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {subscribeError.message}
        </div>
      )}
    </section>
  );
}
