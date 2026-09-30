import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  getSetupProgress,
  useSetupProgress,
  type QueryStateInput,
} from '@/hooks/useSetupProgress';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type {
  SubscriptionStatusResponse,
  GitHubConnectionSummary,
  Ticket,
  Repo,
  Subscription,
} from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockRepo: Repo = {
  fullName: 'octo-user/work-simulator',
  starterTemplate: 'react',
  defaultBranch: 'main',
};

const mockSubscription: Subscription = {
  id: 'sub-11111111-1111-4111-8111-111111111111',
  status: 'active',
  currentPeriodEnd: '2026-10-01T00:00:00.000Z',
  canceledAt: null,
};

const mockTicket: Ticket = {
  id: 'tick-11111111-1111-4111-8111-111111111111',
  status: 'in_progress',
  templateKey: 'react',
  title: 'Fix ticket assignment',
  scenario: 'Scenario details',
  category: 'Frontend',
  difficulty: 'Intermediate',
  touchedFiles: ['src/App.tsx'],
  acceptanceCriteria: ['Passes tests'],
  testChecklist: ['Run test suite'],
  branchName: 'feat/ticket-assignment',
  repo: {
    fullName: 'octo-user/work-simulator',
    defaultBranch: 'main',
  },
  createdAt: '2026-09-29T10:00:00.000Z',
  completedAt: null,
  abandonedAt: null,
};

describe('useSetupProgress and getSetupProgress (doc 10 §10.13; doc 11 §11.2.10 & §11.9)', () => {
  describe('getSetupProgress (pure function)', () => {
    it('getSetupProgress — all done: all four steps done, setupComplete true, canGetTicket false when active ticket exists (Doc 11 §11.2.10)', () => {
      const subscriptionInput: QueryStateInput<SubscriptionStatusResponse> = {
        status: 'success',
        data: { hasAccess: true, subscription: mockSubscription },
      };
      const connectionInput: QueryStateInput<GitHubConnectionSummary> = {
        status: 'success',
        data: { connected: true, githubLogin: 'octocat', repo: mockRepo },
      };
      const ticketInput: QueryStateInput<Ticket | null> = {
        status: 'success',
        data: mockTicket,
      };

      const result = getSetupProgress({
        subscription: subscriptionInput,
        connection: connectionInput,
        currentTicket: ticketInput,
      });

      expect(result.steps).toHaveLength(4);
      expect(result.steps.map((s) => s.key)).toEqual([
        'subscribe',
        'connect_github',
        'create_repo',
        'get_ticket',
      ]);
      expect(result.steps.every((s) => s.status === 'done')).toBe(true);
      expect(result.setupComplete).toBe(true);
      expect(result.canGetTicket).toBe(false);
      expect(result.nextStep).toBeNull();

      expect(result.steps[1].detail).toBe('Connected as @octocat');
      expect(result.steps[0].label).toBe('Subscribe');
      expect(result.steps[1].label).toBe('Connect GitHub');
      expect(result.steps[2].label).toBe('Create your starter repository');
      expect(result.steps[3].label).toBe('Get a ticket');
    });

    it('getSetupProgress — initial setup: not subscribed, disconnected, no repo, no ticket (Doc 11 §11.2.10)', () => {
      const subscriptionInput: QueryStateInput<SubscriptionStatusResponse> = {
        status: 'success',
        data: { hasAccess: false, subscription: null },
      };
      const connectionInput: QueryStateInput<GitHubConnectionSummary> = {
        status: 'success',
        data: { connected: false, githubLogin: null, repo: null },
      };
      const ticketInput: QueryStateInput<Ticket | null> = {
        status: 'success',
        data: null,
      };

      const result = getSetupProgress({
        subscription: subscriptionInput,
        connection: connectionInput,
        currentTicket: ticketInput,
      });

      expect(result.steps.map((s) => s.status)).toEqual(['todo', 'todo', 'todo', 'todo']);
      expect(result.steps[0].label).toBe('Subscribe');
      expect(result.steps[1].label).toBe('Connect GitHub');
      expect(result.steps[2].label).toBe('Create your starter repository');
      expect(result.steps[3].label).toBe('Get a ticket');

      expect(result.steps.map((s) => s.detail)).toEqual([null, null, null, null]);
      expect(result.setupComplete).toBe(false);
      expect(result.canGetTicket).toBe(false);
      expect(result.nextStep).toBe('subscribe');
    });

    it('getSetupProgress — setupComplete true and canGetTicket true when steps 1-3 done and no active ticket (Doc 10 §10.13)', () => {
      const subscriptionInput: QueryStateInput<SubscriptionStatusResponse> = {
        status: 'success',
        data: { hasAccess: true, subscription: mockSubscription },
      };
      const connectionInput: QueryStateInput<GitHubConnectionSummary> = {
        status: 'success',
        data: { connected: true, githubLogin: 'octocat', repo: mockRepo },
      };
      const ticketInput: QueryStateInput<Ticket | null> = {
        status: 'success',
        data: null,
      };

      const result = getSetupProgress({
        subscription: subscriptionInput,
        connection: connectionInput,
        currentTicket: ticketInput,
      });

      expect(result.steps[0].status).toBe('done');
      expect(result.steps[1].status).toBe('done');
      expect(result.steps[2].status).toBe('done');
      expect(result.steps[3].status).toBe('todo');

      expect(result.setupComplete).toBe(true);
      expect(result.canGetTicket).toBe(true);
      expect(result.nextStep).toBe('get_ticket');
    });

    it('getSetupProgress — lapsed subscription: subscription exists but hasAccess false (Doc 11 §11.2.10)', () => {
      const subscriptionInput: QueryStateInput<SubscriptionStatusResponse> = {
        status: 'success',
        data: {
          hasAccess: false,
          subscription: { ...mockSubscription, status: 'past_due' },
        },
      };
      const connectionInput: QueryStateInput<GitHubConnectionSummary> = {
        status: 'success',
        data: { connected: true, githubLogin: 'octocat', repo: mockRepo },
      };
      const ticketInput: QueryStateInput<Ticket | null> = {
        status: 'success',
        data: null,
      };

      const result = getSetupProgress({
        subscription: subscriptionInput,
        connection: connectionInput,
        currentTicket: ticketInput,
      });

      expect(result.steps[0].status).toBe('todo');
      expect(result.steps[0].label).toBe('Subscribe again');
      expect(result.setupComplete).toBe(false);
      expect(result.canGetTicket).toBe(false);
      expect(result.nextStep).toBe('subscribe');
    });

    it('getSetupProgress — disconnected with repo: connected false but repo present (Doc 11 §11.2.10)', () => {
      const subscriptionInput: QueryStateInput<SubscriptionStatusResponse> = {
        status: 'success',
        data: { hasAccess: true, subscription: mockSubscription },
      };
      const connectionInput: QueryStateInput<GitHubConnectionSummary> = {
        status: 'success',
        data: { connected: false, githubLogin: 'octocat', repo: mockRepo },
      };
      const ticketInput: QueryStateInput<Ticket | null> = {
        status: 'success',
        data: null,
      };

      const result = getSetupProgress({
        subscription: subscriptionInput,
        connection: connectionInput,
        currentTicket: ticketInput,
      });

      expect(result.steps[0].status).toBe('done');
      expect(result.steps[1].status).toBe('todo');
      expect(result.steps[1].label).toBe('Reconnect GitHub');
      expect(result.steps[1].detail).toBeNull();
      expect(result.steps[2].status).toBe('done');
      expect(result.steps[2].label).toBe('Create your starter repository');
      expect(result.steps[3].status).toBe('todo');

      expect(result.setupComplete).toBe(false);
      expect(result.canGetTicket).toBe(false);
      expect(result.nextStep).toBe('connect_github');
    });

    it('getSetupProgress — loading states: each query pending maps to loading step; nextStep is null when first incomplete step is loading (Doc 11 §11.2.10)', () => {
      // 1. Subscription pending
      const res1 = getSetupProgress({
        subscription: { status: 'pending', data: undefined },
        connection: { status: 'success', data: { connected: true, githubLogin: 'octocat', repo: mockRepo } },
        currentTicket: { status: 'success', data: null },
      });
      expect(res1.steps[0].status).toBe('loading');
      expect(res1.nextStep).toBeNull();
      expect(res1.setupComplete).toBe(false);
      expect(res1.canGetTicket).toBe(false);

      // 2. Connection pending (affects both connect_github and create_repo)
      const res2 = getSetupProgress({
        subscription: { status: 'success', data: { hasAccess: true, subscription: mockSubscription } },
        connection: { status: 'pending', data: undefined },
        currentTicket: { status: 'success', data: null },
      });
      expect(res2.steps[0].status).toBe('done');
      expect(res2.steps[1].status).toBe('loading');
      expect(res2.steps[2].status).toBe('loading');
      expect(res2.nextStep).toBeNull();
      expect(res2.setupComplete).toBe(false);
      expect(res2.canGetTicket).toBe(false);

      // 3. Current ticket pending (steps 1-3 are done)
      const res3 = getSetupProgress({
        subscription: { status: 'success', data: { hasAccess: true, subscription: mockSubscription } },
        connection: { status: 'success', data: { connected: true, githubLogin: 'octocat', repo: mockRepo } },
        currentTicket: { status: 'pending', data: undefined },
      });
      expect(res3.steps[0].status).toBe('done');
      expect(res3.steps[1].status).toBe('done');
      expect(res3.steps[2].status).toBe('done');
      expect(res3.steps[3].status).toBe('loading');
      expect(res3.setupComplete).toBe(true);
      expect(res3.canGetTicket).toBe(false);
      expect(res3.nextStep).toBeNull();
    });

    it('getSetupProgress — error states: each query error maps to error step; nextStep is null when first incomplete step is error (Doc 11 §11.2.10)', () => {
      // 1. Subscription error
      const res1 = getSetupProgress({
        subscription: { status: 'error', data: undefined },
        connection: { status: 'success', data: { connected: true, githubLogin: 'octocat', repo: mockRepo } },
        currentTicket: { status: 'success', data: null },
      });
      expect(res1.steps[0].status).toBe('error');
      expect(res1.nextStep).toBeNull();
      expect(res1.setupComplete).toBe(false);
      expect(res1.canGetTicket).toBe(false);

      // 2. Connection error
      const res2 = getSetupProgress({
        subscription: { status: 'success', data: { hasAccess: true, subscription: mockSubscription } },
        connection: { status: 'error', data: undefined },
        currentTicket: { status: 'success', data: null },
      });
      expect(res2.steps[0].status).toBe('done');
      expect(res2.steps[1].status).toBe('error');
      expect(res2.steps[2].status).toBe('error');
      expect(res2.nextStep).toBeNull();
      expect(res2.setupComplete).toBe(false);
      expect(res2.canGetTicket).toBe(false);

      // 3. Current ticket error
      const res3 = getSetupProgress({
        subscription: { status: 'success', data: { hasAccess: true, subscription: mockSubscription } },
        connection: { status: 'success', data: { connected: true, githubLogin: 'octocat', repo: mockRepo } },
        currentTicket: { status: 'error', data: undefined },
      });
      expect(res3.steps[0].status).toBe('done');
      expect(res3.steps[1].status).toBe('done');
      expect(res3.steps[2].status).toBe('done');
      expect(res3.steps[3].status).toBe('error');
      expect(res3.setupComplete).toBe(true);
      expect(res3.canGetTicket).toBe(false);
      expect(res3.nextStep).toBeNull();
    });
  });

  describe('useSetupProgress (hook)', () => {
    let queryClient: QueryClient;
    let apiRequestSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retryDelay: 0,
          },
        },
      });
      apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('useSetupProgress — success: combines useSubscription, useGitHubConnection, and useCurrentTicket', async () => {
      apiRequestSpy.mockImplementation(async (_method: string, path: string): Promise<unknown> => {
        if (path === '/subscriptions/me') {
          return {
            statusCode: 200,
            message: 'Subscription status',
            data: { hasAccess: true, subscription: mockSubscription },
          };
        }
        if (path === '/github/connection') {
          return {
            statusCode: 200,
            message: 'GitHub connection',
            data: { connected: true, githubLogin: 'octocat', repo: mockRepo },
          };
        }
        if (path === '/tickets/current') {
          return {
            statusCode: 200,
            message: 'Current ticket',
            data: { ticket: mockTicket },
          };
        }
        throw new Error(`Unexpected path: ${path}`);
      });

      const { result } = renderHook(() => useSetupProgress(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.setupComplete).toBe(true);
      });

      expect(result.current.steps).toHaveLength(4);
      expect(result.current.steps.every((s) => s.status === 'done')).toBe(true);
      expect(result.current.canGetTicket).toBe(false);
      expect(result.current.nextStep).toBeNull();
    });

    it('useSetupProgress — retry: refetches only queries that errored (Doc 11 §11.2.10)', async () => {
      let subscriptionFail = true;
      let ticketFail = true;

      apiRequestSpy.mockImplementation(async (_method: string, path: string): Promise<unknown> => {
        if (path === '/subscriptions/me') {
          if (subscriptionFail) {
            throw new ApiError(500, 'Subscription error', 'api');
          }
          return {
            statusCode: 200,
            message: 'Subscription status',
            data: { hasAccess: true, subscription: mockSubscription },
          };
        }
        if (path === '/github/connection') {
          return {
            statusCode: 200,
            message: 'GitHub connection',
            data: { connected: true, githubLogin: 'octocat', repo: mockRepo },
          };
        }
        if (path === '/tickets/current') {
          if (ticketFail) {
            throw new ApiError(500, 'Ticket error', 'api');
          }
          return {
            statusCode: 200,
            message: 'Current ticket',
            data: { ticket: null },
          };
        }
        throw new Error(`Unexpected path: ${path}`);
      });

      const { result } = renderHook(() => useSetupProgress(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.steps[0].status).toBe('error');
        expect(result.current.steps[1].status).toBe('done');
        expect(result.current.steps[3].status).toBe('error');
      });

      // Clear calls to track retry calls accurately
      apiRequestSpy.mockClear();

      subscriptionFail = false;
      ticketFail = false;

      act(() => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.steps[0].status).toBe('done');
        expect(result.current.steps[3].status).toBe('todo');
        expect(result.current.setupComplete).toBe(true);
        expect(result.current.canGetTicket).toBe(true);
      });

      // Assert that /github/connection was NOT refetched, while /subscriptions/me and /tickets/current were refetched
      const calledPaths = (apiRequestSpy.mock.calls as [string, string][]).map((call) => call[1]);
      expect(calledPaths).toContain('/subscriptions/me');
      expect(calledPaths).toContain('/tickets/current');
      expect(calledPaths).not.toContain('/github/connection');
    });

    it('critical negative test: exact query keys used, bare ["ticket"] is never invalidated or queried (Doc 11 §11.7 & §11.9)', async () => {
      apiRequestSpy.mockImplementation(async (_method: string, path: string): Promise<unknown> => {
        if (path === '/subscriptions/me') {
          return {
            statusCode: 200,
            message: 'Subscription status',
            data: { hasAccess: true, subscription: mockSubscription },
          };
        }
        if (path === '/github/connection') {
          return {
            statusCode: 200,
            message: 'GitHub connection',
            data: { connected: true, githubLogin: 'octocat', repo: mockRepo },
          };
        }
        if (path === '/tickets/current') {
          return {
            statusCode: 200,
            message: 'Current ticket',
            data: { ticket: null },
          };
        }
        throw new Error(`Unexpected path: ${path}`);
      });

      const { result } = renderHook(() => useSetupProgress(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.setupComplete).toBe(true);
      });

      // Exact query keys must exist
      expect(queryClient.getQueryState(queryKeys.subscription)).toBeDefined();
      expect(queryClient.getQueryState(queryKeys.githubConnection)).toBeDefined();
      expect(queryClient.getQueryState(queryKeys.currentTicket)).toBeDefined();

      // Bare ['ticket'] query key must never exist
      expect(queryClient.getQueryState(['ticket'])).toBeUndefined();
    });
  });
});
