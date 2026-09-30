import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTicket } from '@/hooks/tickets/useTicket';
import { useStartTicket } from '@/hooks/tickets/useStartTicket';
import { useAbandonTicket } from '@/hooks/tickets/useAbandonTicket';
import { useAssignTicket } from '@/hooks/tickets/useAssignTicket';
import { useSubmitWork } from '@/hooks/submissions/useSubmitWork';
import { useRetrySubmission } from '@/hooks/submissions/useRetrySubmission';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToast } from '@/hooks/useToast';
import { getTicketPhase, type TicketPrimaryAction, type TicketTab } from '@/lib/ticket-phase';
import { mapApiError, type UiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { TICKET_DONE_SYNC_INTERVAL_MS, TICKET_DONE_SYNC_MAX_ATTEMPTS } from '@/config/app.config';
import type { TicketWithSubmissions } from '@/types';
import ErrorState from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import TicketHeader from '@/components/ticket/TicketHeader';
import TicketActionBar from '@/components/ticket/TicketActionBar';
import TicketDetails from '@/components/ticket/TicketDetails';
import BranchInstructions from '@/components/ticket/BranchInstructions';
import MentorPanel from '@/components/ticket/MentorPanel';
import SubmissionsPanel from '@/components/ticket/SubmissionsPanel';

const tabs: TicketTab[] = ['ticket', 'mentor', 'submissions'];

export default function TicketPage(): React.JSX.Element {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const ticketQuery = useTicket(ticketId);
  const subscriptionQuery = useSubscription();
  const start = useStartTicket(ticketId ?? '');
  const abandon = useAbandonTicket(ticketId ?? '');
  const assign = useAssignTicket();
  const submitWork = useSubmitWork(ticketId ?? '');
  const data = ticketQuery.data;
  const ticket = data?.ticket;
  const submissions = data?.submissions ?? [];
  const phase = ticket ? getTicketPhase(ticket, submissions) : null;
  const retry = useRetrySubmission(ticketId ?? '', phase?.retryAttempt ?? 1);
  const hasAccess = subscriptionQuery.data ? subscriptionQuery.data.hasAccess : true;
  const [pendingAction, setPendingAction] = useState<TicketPrimaryAction | null>(null);
  const [actionError, setActionError] = useState<UiError | null>(null);
  const [isResubmitOpen, setIsResubmitOpen] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [isAbandonOpen, setIsAbandonOpen] = useState(false);
  const [abandonError, setAbandonError] = useState<string | null>(null);
  const syncStarted = useRef(false);
  const completionInvalidated = useRef(false);

  useDocumentTitle(ticket?.title ?? 'Ticket');

  const latestSubmission = [...submissions].sort((first, second) => second.attempt - first.attempt)[0];
  useEffect(() => {
    if (ticket?.status === 'done' && !completionInvalidated.current) {
      completionInvalidated.current = true;
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentTicket });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    }
  }, [queryClient, ticket?.id, ticket?.status]);

  useEffect(() => {
    if (
      !ticketId ||
      ticket?.status !== 'resubmitted' ||
      latestSubmission?.attempt !== 2 ||
      latestSubmission.status !== 'completed' ||
      syncStarted.current
    ) {
      return;
    }

    syncStarted.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const syncTicketDone = async () => {
      for (let attempt = 0; attempt < TICKET_DONE_SYNC_MAX_ATTEMPTS && !cancelled; attempt += 1) {
        await new Promise<void>((resolve) => {
          timer = setTimeout(resolve, TICKET_DONE_SYNC_INTERVAL_MS);
        });
        if (cancelled) break;
        await queryClient.refetchQueries({ queryKey: queryKeys.ticket(ticketId) });
        const refreshed = queryClient.getQueryData<TicketWithSubmissions>(queryKeys.ticket(ticketId));
        if (refreshed?.ticket.status === 'done') break;
      }
      syncStarted.current = false;
    };

    void syncTicketDone();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      syncStarted.current = false;
    };
  }, [latestSubmission?.attempt, latestSubmission?.status, queryClient, ticket?.status, ticketId]);

  const requestedTab = searchParams.get('tab');
  const activeTab: TicketTab = tabs.includes(requestedTab as TicketTab)
    ? (requestedTab as TicketTab)
    : phase?.defaultTab ?? 'ticket';

  const setTab = (nextTab: TicketTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  const handleAction = async (action: TicketPrimaryAction) => {
    setActionError(null);
    if (action === 'resubmit') {
      setResubmitError(null);
      setIsResubmitOpen(true);
      return;
    }

    setPendingAction(action);
    try {
      if (action === 'start') {
        await start.mutateAsync();
        toast.success('Ticket started');
      } else if (action === 'submit') {
        await submitWork.mutateAsync();
        setTab('submissions');
      } else if (action === 'retry' && phase?.retryAttempt !== null && phase?.retryAttempt !== undefined) {
        await retry.mutateAsync();
      } else if (action === 'get_next') {
        const nextTicket = await assign.mutateAsync();
        navigate(`/tickets/${nextTicket.id}`);
      }
    } catch (error: unknown) {
      setActionError(mapApiError(error));
    } finally {
      setPendingAction(null);
    }
  };

  const handleConfirmResubmit = async () => {
    setResubmitError(null);
    try {
      await submitWork.mutateAsync();
      setIsResubmitOpen(false);
      setTab('submissions');
    } catch (error: unknown) {
      const mappedError = mapApiError(error);
      if (mappedError.status === 409) {
        setIsResubmitOpen(false);
        void ticketQuery.refetch();
      } else {
        setResubmitError(mappedError.message);
      }
    }
  };

  const handleConfirmAbandon = async () => {
    setAbandonError(null);
    try {
      const result = await abandon.mutateAsync();
      setIsAbandonOpen(false);
      if (result.newTicket) {
        toast.success("Ticket abandoned. Here's your new ticket.");
        navigate(`/tickets/${result.newTicket.id}`, { replace: true });
      } else {
        toast.success("Ticket abandoned. We couldn't issue a new one right now. Try again from the dashboard.");
        navigate('/dashboard');
      }
    } catch (error: unknown) {
      const mappedError = mapApiError(error);
      if (mappedError.status === 409) {
        setIsAbandonOpen(false);
        void ticketQuery.refetch();
      } else {
        setAbandonError(mappedError.message);
      }
    }
  };

  const handleSettled = () => {
    if (ticketId) void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) });
  };

  if (ticketQuery.isPending) {
    return (
      <div role="status" aria-label="Loading ticket" className="space-y-4 py-8">
        <div className="h-8 w-2/3 animate-pulse bg-muted" />
        <div className="h-5 w-full animate-pulse bg-muted" />
      </div>
    );
  }

  if (ticketQuery.isError) {
    const mappedError = mapApiError(ticketQuery.error);
    if (mappedError.isNotFound || mappedError.status === 400) {
      return (
        <section className="space-y-3 py-8">
          <h1 tabIndex={-1} className="text-xl font-semibold">Ticket not found</h1>
          <p className="text-sm text-muted-foreground">This ticket is unavailable.</p>
          <Link to="/dashboard" className="text-sm font-medium text-primary underline">Go to dashboard</Link>
        </section>
      );
    }
    return <ErrorState message={mappedError.message} onRetry={() => void ticketQuery.refetch()} />;
  }

  if (!ticket || !phase) {
    return <ErrorState message="Ticket not found" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <TicketHeader ticket={ticket} phase={phase} />
      {ticket.status === 'abandoned' && (
        <div role="status" className="border-y border-border py-3 text-sm">This ticket was abandoned.</div>
      )}
      {!hasAccess && (
        <div role="alert" className="border-y border-destructive/20 py-3 text-sm text-destructive">
          An active subscription is required. <Link to="/billing" className="underline">Go to billing</Link>
        </div>
      )}
      <TicketActionBar
        phase={phase}
        hasAccess={hasAccess}
        pendingAction={pendingAction}
        error={actionError}
        onAction={(action) => void handleAction(action)}
      />

      <div role="tablist" aria-label="Ticket workspace" className="flex gap-4 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setTab(tab)}
            className={`border-b-2 px-2 py-2 text-sm capitalize ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'ticket' && (
        <div className="space-y-6">
          <TicketDetails ticket={ticket} />
          <BranchInstructions repoFullName={ticket.repo.fullName} branchName={ticket.branchName} />
          {phase.canAbandon && (
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="button" variant="destructive" disabled={!hasAccess} onClick={() => setIsAbandonOpen(true)}>
                Abandon ticket
              </Button>
            </div>
          )}
        </div>
      )}
      {activeTab === 'mentor' && (
        <MentorPanel ticketId={ticket.id} mentor={phase.mentor} hasAccess={hasAccess} />
      )}
      {activeTab === 'submissions' && (
        <SubmissionsPanel
          ticketId={ticket.id}
          submissions={submissions}
          phase={phase}
          hasAccess={hasAccess}
          retryingAttempt={retry.isPending ? phase.retryAttempt : null}
          onRetry={() => void handleAction('retry')}
          onSettled={handleSettled}
        />
      )}

      <ConfirmDialog
        open={isResubmitOpen}
        onOpenChange={(open) => {
          setIsResubmitOpen(open);
          if (!open) setResubmitError(null);
        }}
        title="Resubmit for final score?"
        description="Your next submission is scored and final. You won't be able to revise after this."
        confirmLabel="Resubmit for final score"
        cancelLabel="Cancel"
        isPending={submitWork.isPending}
        errorMessage={resubmitError}
        onConfirm={() => void handleConfirmResubmit()}
      />
      <ConfirmDialog
        open={isAbandonOpen}
        onOpenChange={(open) => {
          setIsAbandonOpen(open);
          if (!open) setAbandonError(null);
        }}
        title="Abandon ticket?"
        description="This will be marked abandoned and a new ticket issued — your work stays on record. Your mentor conversation is kept and the branch stays in your repository. You can't abandon a ticket after submitting."
        confirmLabel="Abandon ticket"
        cancelLabel="Keep working"
        destructive
        isPending={abandon.isPending}
        errorMessage={abandonError}
        onConfirm={() => void handleConfirmAbandon()}
      />
    </div>
  );
}
