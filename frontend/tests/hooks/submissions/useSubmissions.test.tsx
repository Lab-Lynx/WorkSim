import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubmissions } from '@/hooks/submissions/useSubmissions';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { SubmissionListItem } from '@/types';

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const item: SubmissionListItem = {
  id: '22222222-2222-4222-8222-222222222221',
  attempt: 1,
  status: 'completed',
  prNumber: 7,
  prUrl: 'https://github.com/octo-org/work-sim/pull/7',
  headSha: 'sha-1',
  ciPassed: true,
  ciRunUrl: null,
  failureReason: null,
  submittedAt: '2026-09-29T10:00:00.000Z',
  evaluation: null,
  ticket: {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Fix cart quantity',
    category: 'Bug fix',
    branchName: 'ticket/cart',
  },
  baseBranch: 'main',
};

describe('useSubmissions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests GET /submissions and returns the items', async () => {
    const spy = vi
      .spyOn(apiClient, 'apiRequest')
      .mockResolvedValue({ data: { items: [item] } } as never);
    const client = createClient();

    const { result } = renderHook(() => useSubmissions(), { wrapper: wrapperFor(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith('GET', '/submissions');
    expect(result.current.data).toEqual([item]);
    expect(client.getQueryData(queryKeys.submissions)).toEqual([item]);
  });

  it('does not fetch when disabled', async () => {
    const spy = vi.spyOn(apiClient, 'apiRequest');

    const { result } = renderHook(() => useSubmissions({ enabled: false }), {
      wrapper: wrapperFor(createClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(spy).not.toHaveBeenCalled();
  });

  it('exposes the error when the request fails', async () => {
    vi.spyOn(apiClient, 'apiRequest').mockRejectedValue(new ApiError(500, 'Server error', 'api'));

    const { result } = renderHook(() => useSubmissions({ retry: false }), {
      wrapper: wrapperFor(createClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(500);
  });
});
