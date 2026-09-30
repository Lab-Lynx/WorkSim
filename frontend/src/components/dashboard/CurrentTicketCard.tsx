import { Link } from 'react-router-dom';
import ErrorState from '@/components/common/ErrorState';
import StatusBadge from '@/components/common/StatusBadge';
import SubmitButton from '@/components/common/SubmitButton';
import type { UiError } from '@/lib/api/errors';
import type { Ticket } from '@/types';

export interface CurrentTicketCardProps {
  query: {
    status: 'pending' | 'error' | 'success';
    ticket: Ticket | null | undefined;
    error: UiError | null;
    refetch: () => void;
  };
  canGetTicket: boolean;
  getBlockedReason: string | null;
  isGetting: boolean;
  getError: UiError | null;
  getErrorLink: { to: string; label: string } | null;
  onGetTicket: () => void;
}

export default function CurrentTicketCard({
  query,
  canGetTicket,
  getBlockedReason,
  isGetting,
  getError,
  getErrorLink,
  onGetTicket,
}: CurrentTicketCardProps): React.JSX.Element {
  if (query.status === 'pending') {
    return (
      <div role="status" aria-label="Loading current ticket" className="space-y-3 py-6">
        <div className="h-4 w-32 animate-pulse bg-muted" />
        <div className="h-6 w-3/4 animate-pulse bg-muted" />
        <div className="h-4 w-1/2 animate-pulse bg-muted" />
      </div>
    );
  }

  if (query.status === 'error') {
    return (
      <ErrorState
        message={query.error?.message || 'Failed to load the current ticket.'}
        onRetry={() => query.refetch()}
      />
    );
  }

  const ticket = query.ticket;

  return (
    <section aria-label="Current ticket" className="border-y border-border py-6">
      {ticket ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Active ticket</p>
          <h3 className="mt-3 text-xl font-semibold leading-snug text-foreground">{ticket.title}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              {ticket.category}
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              {ticket.difficulty}
            </span>
            <StatusBadge domain="ticket_status" status={ticket.status} />
          </div>
          <Link
            to={`/tickets/${ticket.id}`}
            className="mt-5 inline-flex text-sm font-medium text-primary underline"
          >
            Continue
          </Link>
        </>
      ) : canGetTicket ? (
        <SubmitButton
          type="button"
          isPending={isGetting}
          pendingLabel="Getting your ticket…"
          onClick={onGetTicket}
        >
          Get your next ticket
        </SubmitButton>
      ) : (
        <p className="text-sm text-muted-foreground">{getBlockedReason}</p>
      )}

      {getError && (
        <div role="alert" className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <span>{getError.message}</span>
          {getErrorLink && (
            <Link to={getErrorLink.to} className="ml-2 font-medium underline">
              {getErrorLink.label}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
