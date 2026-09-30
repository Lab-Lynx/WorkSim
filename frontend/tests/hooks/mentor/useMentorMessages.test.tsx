import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMentorMessages } from '@/hooks/mentor/useMentorMessages';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { MentorMessage } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockTicketId = '11111111-1111-4111-8111-111111111111';

const mockMessages: MentorMessage[] = [
  {
    id: '22222222-2222-4222-8222-222222222221',
    role: 'user',
    content: 'How should I structure the test cases?',
    createdAt: '2026-09-29T10:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    role: 'mentor',
    content: 'Start with the failing edge cases before implementing the happy path.',
    createdAt: '2026-09-29T10:00:08.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222223',
    role: 'user',
    content: 'Should I mock at the API boundary?',
    createdAt: '2026-09-29T10:01:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222224',
    role: 'mentor',
    content: 'Yes, mock at the apiRequest boundary to keep tests reliable.',
    createdAt: '2026-09-29T10:01:10.000Z',
  },
];

describe('useMentorMessages hook (doc 10 §10.10; EP-29; doc 11 §11.2.8, §11.7 & §11.9)', () => {
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

  it('useMentorMessages — history (Doc 11 §11.2.8 & Doc 10 §10.10): calls EP-29, caches under queryKeys.mentor(id), and returns messages in API order (oldest first)', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Mentor history',
      data: { messages: mockMessages },
    });

    const { result } = renderHook(() => useMentorMessages(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-29 GET /tickets/:ticketId/mentor/messages
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith(
      'GET',
      `/tickets/${mockTicketId}/mentor/messages`
    );

    // Returns messages in API order (oldest first)
    expect(result.current.data).toEqual(mockMessages);
    expect(result.current.data).toHaveLength(4);
    expect(result.current.data?.[0].content).toBe('How should I structure the test cases?');
    expect(result.current.data?.[3].content).toBe(
      'Yes, mock at the apiRequest boundary to keep tests reliable.'
    );

    // Caches under exact query key queryKeys.mentor(mockTicketId)
    const cached = queryClient.getQueryData<MentorMessage[]>(
      queryKeys.mentor(mockTicketId)
    );
    expect(cached).toEqual(mockMessages);
  });

  it('useMentorMessages — returns empty array when ticket has no messages yet', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Mentor history',
      data: { messages: [] },
    });

    const { result } = renderHook(() => useMentorMessages(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
    const cached = queryClient.getQueryData<MentorMessage[]>(
      queryKeys.mentor(mockTicketId)
    );
    expect(cached).toEqual([]);
  });

  it('useMentorMessages — disabled while ticketId is undefined (Doc 10 §10.10)', async () => {
    const { result } = renderHook(() => useMentorMessages(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);

    expect(apiRequestSpy).not.toHaveBeenCalled();
  });

  it('useMentorMessages — transition from undefined to defined ticketId triggers fetch', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Mentor history',
      data: { messages: mockMessages },
    });

    let id: string | undefined = undefined;
    const { result, rerender } = renderHook(() => useMentorMessages(id), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(apiRequestSpy).not.toHaveBeenCalled();

    // ID becomes available
    id = mockTicketId;
    rerender();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockMessages);
  });

  it('useMentorMessages — works for a ticket in any status (Doc 10 §10.10; done, abandoned, in_progress)', async () => {
    const terminalTicketId = 'terminal-ticket-uuid';
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Mentor history',
      data: { messages: mockMessages },
    });

    const { result } = renderHook(() => useMentorMessages(terminalTicketId), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockMessages);
    expect(apiRequestSpy).toHaveBeenCalledWith(
      'GET',
      `/tickets/${terminalTicketId}/mentor/messages`
    );
  });

  it('useMentorMessages — 404 ticket not found: exposes error without retrying (Doc 10 §10.10, EP-29)', async () => {
    const error404 = new ApiError(404, 'Ticket not found', 'api');
    apiRequestSpy.mockRejectedValue(error404);

    const { result } = renderHook(() => useMentorMessages('missing-id'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(404);
    expect(result.current.error?.message).toBe('Ticket not found');

    // Never retried on 404
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useMentorMessages — transient 5xx server error retries once per shouldRetryQuery', async () => {
    const error500 = new ApiError(500, 'Internal Server Error', 'api');

    apiRequestSpy
      .mockRejectedValueOnce(error500)
      .mockResolvedValueOnce({
        statusCode: 200,
        message: 'Mentor history',
        data: { messages: mockMessages },
      });

    const { result } = renderHook(() => useMentorMessages(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Retried once
    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(mockMessages);
  });

  it('useMentorMessages — respects options override (e.g. enabled: false)', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Mentor history',
      data: { messages: mockMessages },
    });

    const { result } = renderHook(
      () => useMentorMessages(mockTicketId, { enabled: false }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isLoading).toBe(false);
    expect(apiRequestSpy).not.toHaveBeenCalled();
  });

  it('critical negative test: exact queryKey queryKeys.mentor(id) is used and broad ["ticket"] prefix is never used alone (Doc 11 §11.7 & §11.9)', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Mentor history',
      data: { messages: mockMessages },
    });

    const { result } = renderHook(() => useMentorMessages(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Exact key queryKeys.mentor(id) = ['mentor', id] has the data
    expect(queryClient.getQueryData(['mentor', mockTicketId])).toEqual(mockMessages);

    // Bare ['ticket'] prefix has NO data
    expect(queryClient.getQueryData(['ticket'])).toBeUndefined();
  });
});
