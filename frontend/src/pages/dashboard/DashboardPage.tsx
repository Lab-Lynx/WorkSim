import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/hooks/auth/useMe';
import { useSetupProgress } from '@/hooks/useSetupProgress';
import { useCurrentTicket } from '@/hooks/tickets/useCurrentTicket';
import { useAssignTicket } from '@/hooks/tickets/useAssignTicket';
import SetupChecklist from '@/components/dashboard/SetupChecklist';
import CurrentTicketCard from '@/components/dashboard/CurrentTicketCard';
import { mapApiError, type UiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { GitHubConnectionSummary, Ticket } from '@/types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  const progress = useSetupProgress();
  const currentTicket = useCurrentTicket();
  const assignTicket = useAssignTicket();
  const [getError, setGetError] = useState<UiError | null>(null);
  const [getErrorLink, setGetErrorLink] = useState<{ to: string; label: string } | null>(null);

  const handleGetTicket = async () => {
    setGetError(null);
    setGetErrorLink(null);

    try {
      const ticket = await assignTicket.mutateAsync();
      navigate(`/tickets/${ticket.id}`);
    } catch (error: unknown) {
      const uiError = mapApiError(error);

      if (uiError.status === 402) {
        setGetErrorLink({ to: '/billing', label: 'Go to billing' });
      } else if (uiError.status === 403) {
        setGetErrorLink({ to: '/github', label: 'Reconnect GitHub' });
      } else if (uiError.status === 409) {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: queryKeys.currentTicket }),
          queryClient.refetchQueries({ queryKey: queryKeys.githubConnection }),
        ]);

        const assignedTicket = queryClient.getQueryData<Ticket | null>(queryKeys.currentTicket);
        if (assignedTicket) {
          navigate(`/tickets/${assignedTicket.id}`);
          return;
        }

        const connection = queryClient.getQueryData<GitHubConnectionSummary>(
          queryKeys.githubConnection
        );
        if (connection?.repo === null) {
          setGetErrorLink({ to: '/github', label: 'Create your starter repository' });
        }
      }

      setGetError(uiError);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Work Simulator</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.
        </h1>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="setup-heading">
          <h2 id="setup-heading" className="mb-4 text-xl font-semibold tracking-tight">
            Setup progress
          </h2>
          <SetupChecklist progress={progress} onRetry={progress.retry} />
        </section>

        <section aria-labelledby="ticket-heading">
          <h2 id="ticket-heading" className="mb-4 text-xl font-semibold tracking-tight">
            Current ticket
          </h2>
          <CurrentTicketCard
            query={{
              status: currentTicket.status,
              ticket: currentTicket.data,
              error: currentTicket.error ? mapApiError(currentTicket.error) : null,
              refetch: () => void currentTicket.refetch(),
            }}
            canGetTicket={progress.canGetTicket}
            getBlockedReason={
              progress.setupComplete ? null : 'Finish setup to get a ticket.'
            }
            isGetting={assignTicket.isPending}
            getError={getError}
            getErrorLink={getErrorLink}
            onGetTicket={() => void handleGetTicket()}
          />
        </section>
      </div>
    </div>
  );
}
