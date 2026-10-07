import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import SubmitButton from '@/components/common/SubmitButton';
import { useAssignTicket } from '@/hooks/tickets/useAssignTicket';
import { mapApiError, type UiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { GitHubConnectionSummary, Ticket } from '@/types';

type ErrorLink = { to: string; label: string };

export default function GetTicketPanel(): React.JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const assignTicket = useAssignTicket();
  const [error, setError] = useState<UiError | null>(null);
  const [errorLink, setErrorLink] = useState<ErrorLink | null>(null);

  const handleGetTicket = async () => {
    setError(null);
    setErrorLink(null);

    try {
      const ticket = await assignTicket.mutateAsync();
      navigate(`/tickets/${ticket.id}`, { replace: true });
    } catch (caught: unknown) {
      const uiError = mapApiError(caught);

      if (uiError.status === 402) {
        setErrorLink({ to: '/billing', label: 'Go to billing' });
      } else if (uiError.status === 403) {
        setErrorLink({ to: '/github', label: 'Reconnect GitHub' });
      } else if (uiError.status === 409) {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: queryKeys.currentTicket }),
          queryClient.refetchQueries({ queryKey: queryKeys.githubConnection }),
        ]);

        const assigned = queryClient.getQueryData<Ticket | null>(queryKeys.currentTicket);
        if (assigned) {
          navigate(`/tickets/${assigned.id}`, { replace: true });
          return;
        }

        const connection = queryClient.getQueryData<GitHubConnectionSummary>(
          queryKeys.githubConnection,
        );
        if (connection?.repo === null) {
          setErrorLink({ to: '/github', label: 'Create your starter repository' });
        }
      }

      setError(uiError);
    }
  };

  return (
    <section
      aria-label="Get a ticket"
      className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 py-16 text-center"
    >
      <h2 className="font-heading text-xl font-medium">No active ticket</h2>
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
        Get your next ticket to receive a task, a working branch on your starter repository, and
        your mentor.
      </p>
      <SubmitButton
        type="button"
        isPending={assignTicket.isPending}
        pendingLabel="Getting your ticket…"
        onClick={handleGetTicket}
      >
        Get your next ticket
      </SubmitButton>

      {error && (
        <div
          role="alert"
          className="w-full rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <span>{error.message}</span>
          {errorLink && (
            <Link to={errorLink.to} className="ml-2 font-medium underline">
              {errorLink.label}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
