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
    <section aria-label="Current ticket" className="space-y-4">
      {ticket ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">Active ticket · {ticket.id.slice(0, 8)}</p>
              <h3 className="font-heading text-xl font-medium leading-snug text-foreground">
                {ticket.title}
              </h3>
            </div>
            <StatusBadge domain="ticket_status" status={ticket.status} />
          </div>
          {ticket.scenario && (
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              {ticket.scenario}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span>
              Category <span className="font-medium text-foreground">{ticket.category}</span>
            </span>
            <span>
              Difficulty <span className="font-medium text-foreground">{ticket.difficulty}</span>
            </span>
            {ticket.repo?.fullName && (
              <span>
                Repo{' '}
                <span className="font-mono text-foreground">{ticket.repo.fullName}</span>
              </span>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Link
              to={`/tickets/${ticket.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              Continue ticket
            </Link>
          </div>
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
        <div
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
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
