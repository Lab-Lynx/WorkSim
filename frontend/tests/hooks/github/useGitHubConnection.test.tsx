import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGitHubConnection } from '@/hooks/github/useGitHubConnection';
import * as apiClient from '@/lib/api/client';
import { ApiError, handleGlobalApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { GitHubConnectionSummary, Repo } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockRepo: Repo = {
  fullName: 'octocat/work-simulator',
  starterTemplate: 'react',
  defaultBranch: 'main',
};

const mockConnectedSummary: GitHubConnectionSummary = {
  connected: true,
  githubLogin: 'octocat',
  repo: mockRepo,
};

describe('useGitHubConnection hook (doc 10 §10.8; EP-20; doc 11 §11.2.6 & §11.9)', () => {
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

  it('useGitHubConnection — connected: calls GET /github/connection, caches under queryKeys.githubConnection', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'GitHub connection',
      data: mockConnectedSummary,
    });

    const { result } = renderHook(() => useGitHubConnection(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/github/connection');

    expect(result.current.data).toEqual(mockConnectedSummary);
    expect(
      queryClient.getQueryData<GitHubConnectionSummary>(queryKeys.githubConnection)
    ).toEqual(mockConnectedSummary);
  });

  it('useGitHubConnection — connected without starter repo yet', async () => {
    const summaryNoRepo: GitHubConnectionSummary = {
      connected: true,
      githubLogin: 'octocat',
      repo: null,
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'GitHub connection',
      data: summaryNoRepo,
    });

    const { result } = renderHook(() => useGitHubConnection(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(summaryNoRepo);
    expect(result.current.data?.connected).toBe(true);
    expect(result.current.data?.githubLogin).toBe('octocat');
    expect(result.current.data?.repo).toBeNull();
  });

  it('useGitHubConnection — never infers connected from repo: repo can be non-null while connected is false (A-07)', async () => {
    // When a user disconnects GitHub, their starter repository record survives (A-07)
    // Nothing in the client must infer connected = true from the existence of repo
    const disconnectedWithRepo: GitHubConnectionSummary = {
      connected: false,
      githubLogin: null,
      repo: mockRepo,
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'GitHub connection',
      data: disconnectedWithRepo,
    });

    const { result } = renderHook(() => useGitHubConnection(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(disconnectedWithRepo);
    expect(result.current.data?.connected).toBe(false);
    expect(result.current.data?.repo).toEqual(mockRepo);
  });

  it('useGitHubConnection — disconnected with no repo', async () => {
    const disconnectedNoRepo: GitHubConnectionSummary = {
      connected: false,
      githubLogin: null,
      repo: null,
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'GitHub connection',
      data: disconnectedNoRepo,
    });

    const { result } = renderHook(() => useGitHubConnection(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(disconnectedNoRepo);
    expect(result.current.data?.connected).toBe(false);
    expect(result.current.data?.githubLogin).toBeNull();
    expect(result.current.data?.repo).toBeNull();
  });

  it('useGitHubConnection — 403 error: exposes error, does not retry, global handler invalidates connection', async () => {
    const error403 = new ApiError(
      403,
      'Your GitHub connection is no longer valid. Reconnect GitHub to continue',
      'api'
    );
    apiRequestSpy.mockRejectedValue(error403);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useGitHubConnection(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(403);
    // 403 must not be automatically retried
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);

    // Global error handler invalidates queryKeys.githubConnection on 403
    handleGlobalApiError(result.current.error, queryClient);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });
  });

  it('useGitHubConnection — 401 unauthorized: surfaces error and does not retry', async () => {
    const error401 = new ApiError(401, 'Unauthorized', 'api');
    apiRequestSpy.mockRejectedValue(error401);

    const { result } = renderHook(() => useGitHubConnection(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(401);
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useGitHubConnection — transient failure: retries once per shouldRetryQuery on 5xx', async () => {
    const error500 = new ApiError(500, 'Server Error', 'api');
    apiRequestSpy
      .mockRejectedValueOnce(error500)
      .mockResolvedValueOnce({
        statusCode: 200,
        message: 'GitHub connection',
        data: mockConnectedSummary,
      });

    const { result } = renderHook(() => useGitHubConnection(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(mockConnectedSummary);
  });

  it('useGitHubConnection — forwards custom options such as enabled: false', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'GitHub connection',
      data: mockConnectedSummary,
    });

    const { result } = renderHook(() => useGitHubConnection({ enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(false);
    expect(apiRequestSpy).not.toHaveBeenCalled();
  });
});
