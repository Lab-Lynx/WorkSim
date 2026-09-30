import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGitHubConnect } from '@/hooks/github/useGitHubConnect';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useGitHubConnect hook (doc 10 §10.8; EP-18; doc 11 §11.2.6 & §11.9)', () => {
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

  it('useGitHubConnect — success: calls GET /github/connect, unwraps authorizeUrl, does not navigate, does not store OAuth attempt', async () => {
    const authorizeUrl =
      'https://github.com/login/oauth/authorize?client_id=fake_client_id&scope=repo,write:repo_hook&state=signed_state_token';

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'GitHub authorization URL',
      data: { authorizeUrl },
    });

    const initialHref = window.location.href;
    const localStorageSetItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => useGitHubConnect(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-18 GET /github/connect
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/github/connect');

    // Returns unwrapped authorizeUrl string
    expect(result.current.data).toBe(authorizeUrl);

    // Does not navigate (GitHubSetupPage calls window.location.assign)
    expect(window.location.href).toBe(initialHref);

    // Does not store OAuth attempt locally
    expect(localStorageSetItemSpy).not.toHaveBeenCalled();
  });

  describe('URL validation (A-67)', () => {
    it('throws ApiError with kind "unexpected_response" if authorizeUrl uses insecure http: protocol', async () => {
      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 200,
        message: 'GitHub authorization URL',
        data: { authorizeUrl: 'http://github.com/login/oauth/authorize?client_id=123' },
      });

      const { result } = renderHook(() => useGitHubConnect(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.kind).toBe('unexpected_response');
    });

    it('throws ApiError with kind "unexpected_response" if authorizeUrl is a relative URL', async () => {
      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 200,
        message: 'GitHub authorization URL',
        data: { authorizeUrl: '/github/oauth/authorize' },
      });

      const { result } = renderHook(() => useGitHubConnect(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.kind).toBe('unexpected_response');
    });

    it('throws ApiError with kind "unexpected_response" if authorizeUrl is javascript: or non-https scheme', async () => {
      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 200,
        message: 'GitHub authorization URL',
        data: { authorizeUrl: 'javascript:alert(1)' },
      });

      const { result } = renderHook(() => useGitHubConnect(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.kind).toBe('unexpected_response');
    });

    it('throws ApiError with kind "unexpected_response" if authorizeUrl is missing or invalid', async () => {
      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 200,
        message: 'GitHub authorization URL',
        data: { authorizeUrl: '' },
      });

      const { result } = renderHook(() => useGitHubConnect(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.kind).toBe('unexpected_response');
    });
  });

  describe('Error handling and options', () => {
    it('useGitHubConnect — 402 no access: exposes billing error and leaves handling to page/global handler', async () => {
      const error402 = new ApiError(402, 'An active subscription is required', 'api');
      apiRequestSpy.mockRejectedValueOnce(error402);

      const initialHref = window.location.href;

      const { result } = renderHook(() => useGitHubConnect(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error402);
      expect(result.current.error?.status).toBe(402);
      expect(window.location.href).toBe(initialHref);
      expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    });

    it('useGitHubConnect — mutation retry is disabled: never auto-retries', async () => {
      const error500 = new ApiError(500, 'Server Error', 'api');
      apiRequestSpy.mockRejectedValueOnce(error500);

      const { result } = renderHook(() => useGitHubConnect(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(apiRequestSpy).toHaveBeenCalledTimes(1);
      expect(result.current.error).toEqual(error500);
    });

    it('useGitHubConnect — forwards custom onSuccess and onError callbacks', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const authorizeUrl = 'https://github.com/login/oauth/authorize?client_id=xyz';

      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 200,
        message: 'GitHub authorization URL',
        data: { authorizeUrl },
      });

      const { result } = renderHook(() => useGitHubConnect({ onSuccess, onError }), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(
        authorizeUrl,
        undefined,
        undefined,
        expect.any(Object)
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it('useGitHubConnect — forwards custom onError callback on failure', async () => {
      const onError = vi.fn();
      const error402 = new ApiError(402, 'An active subscription is required', 'api');
      apiRequestSpy.mockRejectedValueOnce(error402);

      const { result } = renderHook(() => useGitHubConnect({ onError }), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        error402,
        undefined,
        undefined,
        expect.any(Object)
      );
    });
  });
});
