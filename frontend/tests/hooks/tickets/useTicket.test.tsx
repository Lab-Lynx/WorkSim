import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTicket } from '@/hooks/tickets/useTicket';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Submission, Ticket, TicketWithSubmissions } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockAssignedTicket: Ticket = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'assigned',
  templateKey: 'react',
  title: 'Fix CSRF token check',
  scenario: 'Requests are missing CSRF validation in edge cases.',
  category: 'Security',
  difficulty: 'Medium',
  touchedFiles: ['src/lib/csrf.ts'],
  acceptanceCriteria: ['Enforce CSRF check on mutating requests'],
  testChecklist: ['Unit tests pass'],
  branchName: 'ticket/csrf-token-check',
  repo: {
    fullName: 'octo-org/work-sim',
    defaultBranch: 'main',
  },
  createdAt: '2026-09-28T10:00:00.000Z',
  completedAt: null,
  abandonedAt: null,
};

const mockDoneTicket: Ticket = {
  ...mockAssignedTicket,
  id: '22222222-2222-4222-8222-222222222222',
  status: 'done',
  completedAt: '2026-09-28T14:00:00.000Z',
};

const mockAbandonedTicket: Ticket = {
  ...mockAssignedTicket,
  id: '33333333-3333-4333-8333-333333333333',
  status: 'abandoned',
  abandonedAt: '2026-09-28T11:00:00.000Z',
};

const mockSubmission1: Submission = {
  id: '44444444-4444-4444-8444-444444444441',
  attempt: 1,
  status: 'completed',
  prNumber: 10,
  prUrl: 'https://github.com/octo-org/work-sim/pull/10',
  headSha: 'commit1',
  ciPassed: true,
  ciRunUrl: 'https://github.com/octo-org/work-sim/actions/runs/10',
  failureReason: null,
  submittedAt: '2026-09-28T12:00:00.000Z',
  evaluation: null,
};

const mockSubmission2: Submission = {
  id: '44444444-4444-4444-8444-444444444442',
  attempt: 2,
  status: 'completed',
  prNumber: 11,
  prUrl: 'https://github.com/octo-org/work-sim/pull/11',
  headSha: 'commit2',
  ciPassed: true,
  ciRunUrl: 'https://github.com/octo-org/work-sim/actions/runs/11',
  failureReason: null,
  submittedAt: '2026-09-28T13:30:00.000Z',
  evaluation: {
    feedback: 'Excellent work!',
    scores: {
      requirementsMet: 25,
      correctnessTests: 25,
      codeQuality: 25,
      problemSolving: 25,
      total: 100,
    },
    createdAt: '2026-09-28T13:35:00.000Z',
  },
};

describe('useTicket hook (doc 10 §10.9; EP-25; doc 11 §11.2.7, §11.7 & §11.9)', () => {
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

  it('useTicket — success (Doc 11 §11.2.7): calls EP-25, caches under queryKeys.ticket(id), and returns { ticket, submissions }', async () => {
    const payload: TicketWithSubmissions = {
      ticket: mockAssignedTicket,
      submissions: [],
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket',
      data: payload,
    });

    const { result } = renderHook(() => useTicket(mockAssignedTicket.id), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-25 GET /tickets/:ticketId
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('GET', `/tickets/${mockAssignedTicket.id}`);

    // Returns ticket and 0 submissions
    expect(result.current.data).toEqual(payload);
    expect(result.current.data?.ticket).toEqual(mockAssignedTicket);
    expect(result.current.data?.submissions).toEqual([]);

    // Caches under exact query key queryKeys.ticket(id)
    const cached = queryClient.getQueryData<TicketWithSubmissions>(
      queryKeys.ticket(mockAssignedTicket.id)
    );
    expect(cached).toEqual(payload);
  });

  it('useTicket — returns 0–2 submissions without diff (Doc 10 §10.9)', async () => {
    const payload: TicketWithSubmissions = {
      ticket: mockAssignedTicket,
      submissions: [mockSubmission1, mockSubmission2],
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket',
      data: payload,
    });

    const { result } = renderHook(() => useTicket(mockAssignedTicket.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.submissions).toHaveLength(2);
    expect(result.current.data?.submissions[0].diff).toBeUndefined();
    expect(result.current.data?.submissions[1].diff).toBeUndefined();
  });

  it('useTicket — works for done tickets (Doc 10 §10.9)', async () => {
    const payload: TicketWithSubmissions = {
      ticket: mockDoneTicket,
      submissions: [mockSubmission1, mockSubmission2],
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket',
      data: payload,
    });

    const { result } = renderHook(() => useTicket(mockDoneTicket.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.ticket.status).toBe('done');
    expect(result.current.data?.ticket.completedAt).toBe(mockDoneTicket.completedAt);
    expect(result.current.data?.submissions).toHaveLength(2);
  });

  it('useTicket — works for abandoned tickets (Doc 10 §10.9)', async () => {
    const payload: TicketWithSubmissions = {
      ticket: mockAbandonedTicket,
      submissions: [mockSubmission1],
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket',
      data: payload,
    });

    const { result } = renderHook(() => useTicket(mockAbandonedTicket.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.ticket.status).toBe('abandoned');
    expect(result.current.data?.ticket.abandonedAt).toBe(mockAbandonedTicket.abandonedAt);
  });

  it('useTicket — ownership 404 (Doc 11 §11.2.7): exposes not-found state without revealing ownership and is never retried', async () => {
    const error404 = new ApiError(404, 'Ticket not found', 'api');
    apiRequestSpy.mockRejectedValue(error404);

    const { result } = renderHook(() => useTicket('unknown-ticket-id'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(404);
    expect(result.current.error?.message).toBe('Ticket not found');

    // Never retried on 404 (Doc 10 §10.9)
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useTicket — malformed ID 400 (Doc 10 §10.9): treated as not-found state and is never retried', async () => {
    const error400 = new ApiError(400, 'Ticket not found', 'api');
    apiRequestSpy.mockRejectedValue(error400);

    const { result } = renderHook(() => useTicket('malformed-uuid'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(400);
    // Never retried on 400
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useTicket — disabled while ticketId is undefined (Doc 10 §10.9)', async () => {
    const { result } = renderHook(() => useTicket(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);

    // API request is never called when disabled
    expect(apiRequestSpy).not.toHaveBeenCalled();
  });

  it('useTicket — transition from undefined to defined ticketId triggers fetch', async () => {
    const payload: TicketWithSubmissions = {
      ticket: mockAssignedTicket,
      submissions: [],
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket',
      data: payload,
    });

    let id: string | undefined = undefined;
    const { result, rerender } = renderHook(() => useTicket(id), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiRequestSpy).not.toHaveBeenCalled();

    // ID becomes available
    id = mockAssignedTicket.id;
    rerender();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(payload);
  });

  it('useTicket — transient 5xx server error retries once per shouldRetryQuery', async () => {
    const payload: TicketWithSubmissions = {
      ticket: mockAssignedTicket,
      submissions: [],
    };
    const error500 = new ApiError(500, 'Internal Server Error', 'api');

    apiRequestSpy
      .mockRejectedValueOnce(error500)
      .mockResolvedValueOnce({
        statusCode: 200,
        message: 'Ticket',
        data: payload,
      });

    const { result } = renderHook(() => useTicket(mockAssignedTicket.id), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Retried once
    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(payload);
  });

  it('useTicket — forwards custom options such as enabled: false', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Ticket',
      data: { ticket: mockAssignedTicket, submissions: [] },
    });

    const { result } = renderHook(
      () => useTicket(mockAssignedTicket.id, { enabled: false }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isLoading).toBe(false);
    expect(apiRequestSpy).not.toHaveBeenCalled();
  });

  it('critical negative test: exact queryKey queryKeys.ticket(id) is used and broad ["ticket"] prefix is never used alone (Doc 11 §11.7 & §11.9)', async () => {
    const ticketId = mockAssignedTicket.id;
    const payload: TicketWithSubmissions = {
      ticket: mockAssignedTicket,
      submissions: [],
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket',
      data: payload,
    });

    const { result } = renderHook(() => useTicket(ticketId), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verified cached under queryKeys.ticket(id) = ['ticket', id]
    expect(queryClient.getQueryData(['ticket', ticketId])).toEqual(payload);

    // Bare ['ticket'] prefix has NO data
    expect(queryClient.getQueryData(['ticket'])).toBeUndefined();
  });
});
