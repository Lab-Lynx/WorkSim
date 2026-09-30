import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSendMentorMessage } from '@/hooks/mentor/useSendMentorMessage';
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

const mockExistingUserMessage: MentorMessage = {
  id: '22222222-2222-4222-8222-222222222221',
  role: 'user',
  content: 'How should I handle input validation?',
  createdAt: '2026-09-29T10:00:00.000Z',
};

const mockExistingMentorMessage: MentorMessage = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'mentor',
  content: 'Consider checking the input schema with Zod.',
  createdAt: '2026-09-29T10:00:05.000Z',
};

const mockNewUserMessage: MentorMessage = {
  id: '33333333-3333-4333-8333-333333333331',
  role: 'user',
  content: 'Could you clarify the error envelope?',
  createdAt: '2026-09-29T10:05:00.000Z',
};

const mockNewMentorMessage: MentorMessage = {
  id: '33333333-3333-4333-8333-333333333332',
  role: 'mentor',
  content: 'The error envelope always returns statusCode, success: false, and message.',
  createdAt: '2026-09-29T10:05:10.000Z',
};

describe('useSendMentorMessage hook (doc 10 §10.10; EP-28; doc 11 §11.2.8, §11.7 & §11.9)', () => {
  let queryClient: QueryClient;
  let apiRequestSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('useSendMentorMessage — success (Doc 11 §11.2.8): appends userMessage then mentorMessage to existing cache in API order', async () => {
    // Seed existing mentor messages
    queryClient.setQueryData<MentorMessage[]>(queryKeys.mentor(mockTicketId), [
      mockExistingUserMessage,
      mockExistingMentorMessage,
    ]);

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Mentor replied',
      data: {
        userMessage: mockNewUserMessage,
        mentorMessage: mockNewMentorMessage,
      },
    });

    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate({ content: 'Could you clarify the error envelope?' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-28 POST /tickets/:ticketId/mentor/messages with body { content }
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith(
      'POST',
      `/tickets/${mockTicketId}/mentor/messages`,
      {
        body: { content: 'Could you clarify the error envelope?' },
      }
    );

    // Returns unwrapped data
    expect(result.current.data).toEqual({
      userMessage: mockNewUserMessage,
      mentorMessage: mockNewMentorMessage,
    });

    // Appended userMessage then mentorMessage
    const cached = queryClient.getQueryData<MentorMessage[]>(
      queryKeys.mentor(mockTicketId)
    );
    expect(cached).toEqual([
      mockExistingUserMessage,
      mockExistingMentorMessage,
      mockNewUserMessage,
      mockNewMentorMessage,
    ]);

    expect(setQueryDataSpy).toHaveBeenCalledWith(
      queryKeys.mentor(mockTicketId),
      [
        mockExistingUserMessage,
        mockExistingMentorMessage,
        mockNewUserMessage,
        mockNewMentorMessage,
      ]
    );

    // Critical negative check: never invalidates broad ['ticket'] prefix
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }
  });

  it('useSendMentorMessage — success when mentor cache was empty/uncached (Doc 10 §10.10): invalidates mentor cache instead of appending', async () => {
    // Mentor cache is NOT seeded (undefined)
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Mentor replied',
      data: {
        userMessage: mockNewUserMessage,
        mentorMessage: mockNewMentorMessage,
      },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ content: 'Could you clarify the error envelope?' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Invalidates queryKeys.mentor(mockTicketId)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.mentor(mockTicketId),
    });
    // setQueryData should not have been called for queryKeys.mentor
    expect(setQueryDataSpy).not.toHaveBeenCalledWith(
      queryKeys.mentor(mockTicketId),
      expect.anything()
    );
  });

  it('useSendMentorMessage — body is strictly { content } and never carries a hint level, attempt, or role (Doc 10 §10.10)', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Mentor replied',
      data: {
        userMessage: mockNewUserMessage,
        mentorMessage: mockNewMentorMessage,
      },
    });

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    // Even if extra fields were cast/passed into mutate
    act(() => {
      result.current.mutate({
        content: 'Hint please',
        // @ts-expect-error test negative payload pollution
        hintLevel: 2,
        attempt: 1,
        role: 'user',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    const callOptions = apiRequestSpy.mock.calls[0][2];
    expect(callOptions?.body).toEqual({ content: 'Hint please' });
    expect(callOptions?.body).not.toHaveProperty('hintLevel');
    expect(callOptions?.body).not.toHaveProperty('attempt');
    expect(callOptions?.body).not.toHaveProperty('role');
  });

  it('useSendMentorMessage — does NOT add the message to the cache before the reply arrives (no optimistic update; Doc 10 §10.10, A-29)', async () => {
    queryClient.setQueryData<MentorMessage[]>(queryKeys.mentor(mockTicketId), [
      mockExistingUserMessage,
      mockExistingMentorMessage,
    ]);

    let resolveApi!: (value: unknown) => void;
    apiRequestSpy.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveApi = resolve;
      })
    );

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    act(() => {
      result.current.mutate({ content: 'Waiting for reply...' });
    });

    // Mid-flight: cache must NOT contain the pending message, and setQueryData must not have been called
    const midFlightCache = queryClient.getQueryData<MentorMessage[]>(
      queryKeys.mentor(mockTicketId)
    );
    expect(midFlightCache).toEqual([
      mockExistingUserMessage,
      mockExistingMentorMessage,
    ]);
    expect(setQueryDataSpy).not.toHaveBeenCalled();

    // Resolve server response
    await act(async () => {
      resolveApi({
        statusCode: 201,
        message: 'Mentor replied',
        data: {
          userMessage: mockNewUserMessage,
          mentorMessage: mockNewMentorMessage,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Now cached
    const afterSuccessCache = queryClient.getQueryData<MentorMessage[]>(
      queryKeys.mentor(mockTicketId)
    );
    expect(afterSuccessCache).toHaveLength(4);
  });

  it('useSendMentorMessage — 409 conflict (Doc 11 §11.2.8 & Doc 10 §10.10): invalidates queryKeys.ticket(ticketId) for pending reconciliation (D-04)', async () => {
    const error409 = new ApiError(
      409,
      'The mentor is only available while the ticket is in progress or awaiting revision',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(error409);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ content: 'Hello after submit' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error409);

    // Invalidate ticket cache so page can detect phase change (D-04)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
    // Does NOT invalidate mentor cache on 409
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.mentor(mockTicketId),
    });
    // Critical negative check: never invalidates broad ['ticket'] prefix
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }
  });

  it('useSendMentorMessage — timeout error (Doc 10 §10.10 & A-71): invalidates queryKeys.mentor(ticketId) so MentorPanel can reconcile', async () => {
    const timeoutError = new ApiError(0, 'Request timed out', 'timeout');
    apiRequestSpy.mockRejectedValueOnce(timeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ content: 'Slow message' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(timeoutError);

    // Timeout invalidates mentor cache so MentorPanel can reconcile transcripts (A-71)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.mentor(mockTicketId),
    });
    // Does NOT invalidate ticket cache on timeout
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
  });

  it('useSendMentorMessage — 408 / 504 status timeout: invalidates queryKeys.mentor(ticketId)', async () => {
    const gatewayTimeoutError = new ApiError(504, 'Gateway Timeout', 'api');
    apiRequestSpy.mockRejectedValueOnce(gatewayTimeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ content: 'Slow message' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.mentor(mockTicketId),
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
  });

  it('useSendMentorMessage — timeout in error message: invalidates queryKeys.mentor(ticketId)', async () => {
    const msgTimeoutError = new ApiError(500, 'Gateway connection timeout', 'api');
    apiRequestSpy.mockRejectedValueOnce(msgTimeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ content: 'Slow message' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.mentor(mockTicketId),
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
  });

  it('useSendMentorMessage — 429 rate limit (FR-41, Doc 10 §10.10): exposes error and does not invalidate ticket or mentor', async () => {
    const error429 = new ApiError(
      429,
      'Mentor message limit reached for this ticket',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(error429);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ content: 'One too many messages' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error429);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it('useSendMentorMessage — 502 mentor call failure (Doc 10 §10.10): exposes error and allows retry without duplicating messages', async () => {
    const error502 = new ApiError(
      502,
      'The mentor is unavailable, please try again',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(error502);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ content: 'Help needed' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error502);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it('useSendMentorMessage — 400 validation error: exposes error without invalidation', async () => {
    const error400 = new ApiError(400, 'Content cannot be empty', 'api');
    apiRequestSpy.mockRejectedValueOnce(error400);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ content: '' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error400);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it('useSendMentorMessage — 402 subscription error: exposes error without invalidation', async () => {
    const error402 = new ApiError(402, 'An active subscription is required', 'api');
    apiRequestSpy.mockRejectedValueOnce(error402);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ content: 'Help' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error402);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it('useSendMentorMessage — mutation retry is disabled: never auto-retries mutation on failure (Doc 11 §11.9)', async () => {
    const error500 = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ content: 'Help' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Exactly 1 network request; no retry
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(error500);
  });

  it('useSendMentorMessage — forwards onSuccess and onError callbacks from options', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Mentor replied',
      data: {
        userMessage: mockNewUserMessage,
        mentorMessage: mockNewMentorMessage,
      },
    });

    const { result } = renderHook(
      () => useSendMentorMessage(mockTicketId, { onSuccess, onError }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    act(() => {
      result.current.mutate({ content: 'Testing options callback' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(
      {
        userMessage: mockNewUserMessage,
        mentorMessage: mockNewMentorMessage,
      },
      { content: 'Testing options callback' },
      undefined,
      expect.any(Object)
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('useSendMentorMessage — forwards onError callback on failure', async () => {
    const onError = vi.fn();
    const error500 = new ApiError(500, 'Server error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    const { result } = renderHook(
      () => useSendMentorMessage(mockTicketId, { onError }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    act(() => {
      result.current.mutate({ content: 'Testing error callback' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      error500,
      { content: 'Testing error callback' },
      undefined,
      expect.any(Object)
    );
  });

  it('critical negative test: bare ["ticket"] queryKey is NEVER invalidated (Doc 11 §11.7 & §11.9)', async () => {
    const unrelatedTicketId = '99999999-9999-4999-8999-999999999999';
    queryClient.setQueryData(queryKeys.mentor(unrelatedTicketId), [
      mockExistingUserMessage,
    ]);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Trigger 409 which causes queryKeys.ticket(ticketId) invalidation
    const error409 = new ApiError(409, 'Ticket not eligible', 'api');
    apiRequestSpy.mockRejectedValueOnce(error409);

    const { result } = renderHook(() => useSendMentorMessage(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ content: 'Negative test' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Unrelated ticket's mentor cache is untouched
    const unrelatedCache = queryClient.getQueryData(queryKeys.mentor(unrelatedTicketId));
    expect(unrelatedCache).toEqual([mockExistingUserMessage]);

    // Bare ['ticket'] was never invalidated
    const invalidations = invalidateQueriesSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidations).not.toContainEqual(['ticket']);
  });
});
