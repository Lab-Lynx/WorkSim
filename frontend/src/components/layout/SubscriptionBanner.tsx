import React from 'react';
import { Link } from 'react-router-dom';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { getSubscriptionView } from '@/lib/subscription-view';
import { formatDate } from '@/lib/format';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

export const SubscriptionBanner: React.FC = () => {
  const { data } = useSubscription();

  if (!data) {
    return null;
  }

  const view = getSubscriptionView(data);

  if (!view.showsBanner) {
    return null;
  }

  const renderContent = () => {
    switch (view.kind) {
      case 'canceled_access':
        return {
          icon: <Info className="h-4 w-4 text-muted-foreground shrink-0" />,
          message: `Your subscription has been canceled. You retain access until ${formatDate(view.periodEnd)}.`,
          action: null,
          variant: 'bg-muted text-foreground border-border',
        };

      case 'ended':
        return {
          icon: <AlertCircle className="h-4 w-4 text-destructive shrink-0" />,
          message: 'Your subscription has ended.',
          action: (
            <Link
              to="/billing"
              className="text-sm font-medium underline hover:no-underline text-destructive"
            >
              Renew Subscription
            </Link>
          ),
          variant: 'bg-destructive/10 border-destructive/20 text-destructive',
        };

      case 'past_due_access':
      case 'past_due_ended':
        // Q-15 Requirement: Never offers a payment action for past_due
        return {
          icon: <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />,
          message:
            view.kind === 'past_due_access'
              ? `Payment past due. Access will end on ${formatDate(view.periodEnd)}.`
              : 'Payment past due and access has been suspended.',
          action: null,
          variant: 'bg-muted text-foreground border-border',
        };

      default:
        return null;
    }
  };

  const content = renderContent();

  if (!content) {
    return null;
  }

  return (
    <aside role="region" aria-label="Subscription Banner" className="w-full">
      <div
        role="alert"
        aria-live="polite"
        className={`flex items-center justify-between gap-3 px-4 py-3 border text-sm transition-colors ${content.variant}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {content.icon}
          <p className="truncate">{content.message}</p>
        </div>
        {content.action && <div className="shrink-0">{content.action}</div>}
      </div>
    </aside>
  );
};
