import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateRepo } from '@/hooks/github/useCreateRepo';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { CreateRepoInput } from '@/schemas/github.schemas';
import type { Repo } from '@/types';

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

describe('useCreateRepo hook (doc 10 §10.8; EP-22; doc 11 §11.2.6, §11.7 & §11.9)', () => {
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

  it('useCreateRepo — success: POST with custom repoName, returns unwrapped repo, and invalidates queryKeys.githubConnection', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Repository created',
      data: { repo: mockRepo },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const initialHref = window.location.href;

    const { result } = renderHook(() => useCreateRepo(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    const input: CreateRepoInput = {
      starterTemplate: 'react',
      repoName: 'my-custom-sim',
    };

    act(() => {
      result.current.mutate(input);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Calls EP-22 with body containing template and repoName
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/github/repo', {
      body: {
        starterTemplate: 'react',
        repoName: 'my-custom-sim',
      },
    });

    // Returns unwrapped repo data
    expect(result.current.data).toEqual(mockRepo);

    // Invalidates githubConnection cache
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });

    // Does not navigate
    expect(window.location.href).toBe(initialHref);
  });

  it('useCreateRepo — omits repoName from body when empty or whitespace (A-24)', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Repository created',
      data: { repo: mockRepo },
    });

    const { result } = renderHook(() => useCreateRepo(), {
      wrapper: createWrapper(queryClient),
    });

    // Empty string repoName
    act(() => {
      result.current.mutate({
        starterTemplate: 'react',
        repoName: '',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/github/repo', {
      body: { starterTemplate: 'react' },
    });
  });

  it('useCreateRepo — omits repoName from body when undefined', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Repository created',
      data: { repo: mockRepo },
    });

    const { result } = renderHook(() => useCreateRepo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        starterTemplate: 'react',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/github/repo', {
      body: { starterTemplate: 'react' },
    });
  });

  it('useCreateRepo — supports node_express and django templates (D-05)', async () => {
    const nodeRepo: Repo = {
      fullName: 'octocat/node-sim',
      starterTemplate: 'node_express',
      defaultBranch: 'main',
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Repository created',
      data: { repo: nodeRepo },
    });

    const { result: nodeResult } = renderHook(() => useCreateRepo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      nodeResult.current.mutate({ starterTemplate: 'node_express' });
    });

    await waitFor(() => {
      expect(nodeResult.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/github/repo', {
      body: { starterTemplate: 'node_express' },
    });
    expect(nodeResult.current.data).toEqual(nodeRepo);

    // Test django
    const djangoRepo: Repo = {
      fullName: 'octocat/django-sim',
      starterTemplate: 'django',
      defaultBranch: 'main',
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Repository created',
      data: { repo: djangoRepo },
    });

    const { result: djangoResult } = renderHook(() => useCreateRepo(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      djangoResult.current.mutate({ starterTemplate: 'django' });
    });

    await waitFor(() => {
      expect(djangoResult.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/github/repo', {
      body: { starterTemplate: 'django' },
    });
    expect(djangoResult.current.data).toEqual(djangoRepo);
  });

  describe('Validation (doc 11 §11.2.6: schema-invalid input does not call API)', () => {
    it('does not call API if starterTemplate is invalid', async () => {
      const { result } = renderHook(() => useCreateRepo(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        // @ts-expect-error - testing invalid template at runtime
        result.current.mutate({ starterTemplate: 'invalid_template' });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(apiRequestSpy).not.toHaveBeenCalled();
      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.status).toBe(400);
    });

    it('does not call API if repoName is "." or ".."', async () => {
      const { result } = renderHook(() => useCreateRepo(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({
          starterTemplate: 'react',
          repoName: '.',
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(apiRequestSpy).not.toHaveBeenCalled();
      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.status).toBe(400);
    });

    it('does not call API if repoName has invalid characters', async () => {
      const { result } = renderHook(() => useCreateRepo(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({
          starterTemplate: 'react',
          repoName: 'invalid repo name!',
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(apiRequestSpy).not.toHaveBeenCalled();
      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.status).toBe(400);
    });
  });

  describe('Side effects on error (doc 10 §10.8; doc 11 §11.7)', () => {
    it('useCreateRepo — 403 forbidden: invalidates queryKeys.githubConnection and never retries', async () => {
      const error403 = new ApiError(
        403,
        'Your GitHub connection is no longer valid. Reconnect GitHub to continue',
        'api'
      );
      apiRequestSpy.mockRejectedValueOnce(error403);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateRepo(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ starterTemplate: 'react' });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error403);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.githubConnection,
      });
      // Never retries mutation
      expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    });

    it('useCreateRepo — 409 conflict: invalidates queryKeys.githubConnection and never retries', async () => {
      const error409 = new ApiError(
        409,
        'You already have a starter repository',
        'api'
      );
      apiRequestSpy.mockRejectedValueOnce(error409);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateRepo(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ starterTemplate: 'react' });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error409);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.githubConnection,
      });
      expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    });

    it('useCreateRepo — timeout: invalidates queryKeys.githubConnection and never retries', async () => {
      const timeoutError = new ApiError(0, 'Request timed out', 'timeout');
      apiRequestSpy.mockRejectedValueOnce(timeoutError);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateRepo(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ starterTemplate: 'react' });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(timeoutError);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.githubConnection,
      });
      expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    });

    it('useCreateRepo — 502 failure: exposes error and does NOT invalidate cache', async () => {
      const error502 = new ApiError(
        502,
        'GitHub could not create the repository, please try again',
        'api'
      );
      apiRequestSpy.mockRejectedValueOnce(error502);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateRepo(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate({ starterTemplate: 'react' });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error502);
      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
      expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Options forwarding', () => {
    it('forwards custom onSuccess and onError callbacks', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();

      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 201,
        message: 'Repository created',
        data: { repo: mockRepo },
      });

      const { result } = renderHook(
        () => useCreateRepo({ onSuccess, onError }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      const input: CreateRepoInput = { starterTemplate: 'react' };

      act(() => {
        result.current.mutate(input);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(
        mockRepo,
        input,
        undefined,
        expect.any(Object)
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it('forwards custom onError callback on failure', async () => {
      const onError = vi.fn();
      const error502 = new ApiError(502, 'Bad Gateway', 'api');
      apiRequestSpy.mockRejectedValueOnce(error502);

      const { result } = renderHook(
        () => useCreateRepo({ onError }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      const input: CreateRepoInput = { starterTemplate: 'react' };

      act(() => {
        result.current.mutate(input);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        error502,
        input,
        undefined,
        expect.any(Object)
      );
    });
  });
});
