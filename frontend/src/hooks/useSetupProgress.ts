import { useCallback } from 'react';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { useGitHubConnection } from '@/hooks/github/useGitHubConnection';
import { useCurrentTicket } from '@/hooks/tickets/useCurrentTicket';
import type {
  SubscriptionStatusResponse,
  GitHubConnectionSummary,
  Ticket,
} from '@/types';

export type SetupStepKey = 'subscribe' | 'connect_github' | 'create_repo' | 'get_ticket';
export type SetupStepStatus = 'done' | 'todo' | 'loading' | 'error';

export interface SetupStep {
  key: SetupStepKey;
  status: SetupStepStatus;
  label: string;
  detail: string | null;
}

export interface SetupProgress {
  steps: SetupStep[]; // always four: connect_github, create_repo, subscribe, get_ticket
  nextStep: SetupStepKey | null;
  setupComplete: boolean; // steps 1 to 3 are done
  canGetTicket: boolean; // setupComplete and there is no active ticket
}

export interface QueryStateInput<T> {
  status: 'pending' | 'error' | 'success';
  data: T | undefined;
}

export interface GetSetupProgressInput {
  subscription: QueryStateInput<SubscriptionStatusResponse>;
  connection: QueryStateInput<GitHubConnectionSummary>;
  currentTicket: QueryStateInput<Ticket | null>;
}

/**
 * getSetupProgress — Pure helper to derive the dashboard's four setup steps from three queries.
 * Steps are derived, never stored (Doc 10 §10.13).
 */
export function getSetupProgress(input: GetSetupProgressInput): SetupProgress {
  const { subscription, connection, currentTicket } = input;

  // Step 1: subscribe
  let subscribeStatus: SetupStepStatus;
  let subscribeLabel = 'Subscribe';

  if (subscription.status === 'pending') {
    subscribeStatus = 'loading';
  } else if (subscription.status === 'error') {
    subscribeStatus = 'error';
  } else {
    const hasAccess = !!subscription.data?.hasAccess;
    subscribeStatus = hasAccess ? 'done' : 'todo';
    if (
      !hasAccess &&
      subscription.data?.subscription !== null &&
      subscription.data?.subscription !== undefined
    ) {
      subscribeLabel = 'Subscribe again';
    }
  }

  const step1: SetupStep = {
    key: 'subscribe',
    status: subscribeStatus,
    label: subscribeLabel,
    detail: null,
  };

  // Step 2: connect_github
  let connectStatus: SetupStepStatus;
  let connectLabel = 'Connect GitHub';
  let connectDetail: string | null = null;

  if (connection.status === 'pending') {
    connectStatus = 'loading';
  } else if (connection.status === 'error') {
    connectStatus = 'error';
  } else {
    const connected = !!connection.data?.connected;
    connectStatus = connected ? 'done' : 'todo';
    if (connected) {
      connectDetail = connection.data?.githubLogin
        ? `Connected as @${connection.data.githubLogin}`
        : null;
    } else {
      if (connection.data?.repo !== null && connection.data?.repo !== undefined) {
        connectLabel = 'Reconnect GitHub';
      }
    }
  }

  const step2: SetupStep = {
    key: 'connect_github',
    status: connectStatus,
    label: connectLabel,
    detail: connectDetail,
  };

  // Step 3: create_repo
  let repoStatus: SetupStepStatus;
  if (connection.status === 'pending') {
    repoStatus = 'loading';
  } else if (connection.status === 'error') {
    repoStatus = 'error';
  } else {
    repoStatus = connection.data?.repo != null ? 'done' : 'todo';
  }

  const step3: SetupStep = {
    key: 'create_repo',
    status: repoStatus,
    label: 'Create your starter repository',
    detail: null,
  };

  // Step 4: get_ticket
  let ticketStatus: SetupStepStatus;
  if (currentTicket.status === 'pending') {
    ticketStatus = 'loading';
  } else if (currentTicket.status === 'error') {
    ticketStatus = 'error';
  } else {
    ticketStatus = currentTicket.data != null ? 'done' : 'todo';
  }

  const step4: SetupStep = {
    key: 'get_ticket',
    status: ticketStatus,
    label: 'Get a ticket',
    detail: null,
  };

  // GitHub is connected first, the starter repo is created next, and subscribing comes last
  const steps = [step2, step3, step1, step4];

  // setupComplete: connect_github, create_repo and subscribe are all done
  const setupComplete =
    step1.status === 'done' && step2.status === 'done' && step3.status === 'done';

  // canGetTicket: setupComplete and there is no active ticket
  const canGetTicket =
    setupComplete && currentTicket.status === 'success' && currentTicket.data === null;

  // nextStep: the first step that is not done, or null if that step is loading or error (we cannot tell yet)
  const firstIncomplete = steps.find((s) => s.status !== 'done');
  const nextStep =
    !firstIncomplete ||
    firstIncomplete.status === 'loading' ||
    firstIncomplete.status === 'error'
      ? null
      : firstIncomplete.key;

  return {
    steps,
    nextStep,
    setupComplete,
    canGetTicket,
  };
}

/**
 * useSetupProgress — Hook that combines useSubscription, useGitHubConnection, and useCurrentTicket
 * into derived dashboard setup progress with refetch retry helper (Doc 10 §10.13).
 */
export function useSetupProgress(): SetupProgress & { retry: () => void } {
  const subscriptionQuery = useSubscription();
  const connectionQuery = useGitHubConnection();
  const currentTicketQuery = useCurrentTicket();

  const progress = getSetupProgress({
    subscription: {
      status: subscriptionQuery.status,
      data: subscriptionQuery.data,
    },
    connection: {
      status: connectionQuery.status,
      data: connectionQuery.data,
    },
    currentTicket: {
      status: currentTicketQuery.status,
      data: currentTicketQuery.data,
    },
  });

  const retry = useCallback(() => {
    if (subscriptionQuery.isError) {
      subscriptionQuery.refetch();
    }
    if (connectionQuery.isError) {
      connectionQuery.refetch();
    }
    if (currentTicketQuery.isError) {
      currentTicketQuery.refetch();
    }
  }, [subscriptionQuery, connectionQuery, currentTicketQuery]);

  return {
    ...progress,
    retry,
  };
}
