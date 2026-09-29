import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResendVerification } from '@/hooks/auth/useResendVerification';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { RESEND_COOLDOWN_MS } from '@/config/app.config';
import type { ApiResult } from '@/types';

describe('useResendVerification hook (doc 10 §10.6; EP-07; doc 11 §11.2.4)', () => {
  let apiRequestSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('useResendVerification — initial state: has default non-pending, non-cooling down state', () => {
    const { result } = renderHook(() => useResendVerification());

    expect(result.current.isPending).toBe(false);
    expect(result.current.isCoolingDown).toBe(false);
    expect(result.current.cooldownSecondsLeft).toBe(0);
    expect(result.current.cooldownSeconds).toBe(0);
    expect(result.current.message).toBeNull();
    expect(result.current.error).toBeNull();
    expect(typeof result.current.resend).toBe('function');
  });

  it('useResendVerification — success: sends POST /auth/resend-verification with email and stores server message unchanged', async () => {
    const serverMessage =
      'If an unverified account exists for this email, a new verification link has been sent';
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: serverMessage,
      data: null,
    });

    const { result } = renderHook(() => useResendVerification());

    let resendPromise: Promise<void>;
    act(() => {
      resendPromise = result.current.resend('student@example.com');
    });

    expect(result.current.isPending).toBe(true);
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/resend-verification', {
      body: { email: 'student@example.com' },
    });

    await act(async () => {
      await resendPromise;
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.message).toBe(serverMessage);
    expect(result.current.error).toBeNull();
    expect(result.current.isCoolingDown).toBe(true);
    expect(result.current.cooldownSecondsLeft).toBe(60);
    expect(result.current.cooldownSeconds).toBe(60);
  });

  it('useResendVerification — cooldown: blocks second invocation during cooldown and counts down based on timestamp', async () => {
    const serverMessage = 'Verification link sent';
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: serverMessage,
      data: null,
    });

    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend('student@example.com');
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isCoolingDown).toBe(true);
    expect(result.current.cooldownSecondsLeft).toBe(60);

    // Second call during cooldown must be ignored
    await act(async () => {
      await result.current.resend('student@example.com');
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1); // Still 1

    // Advance 15 seconds
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(result.current.isCoolingDown).toBe(true);
    expect(result.current.cooldownSecondsLeft).toBe(45);
    expect(result.current.cooldownSeconds).toBe(45);

    // Background tab survival check: jump forward 30 seconds directly without 1s interval steps
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.isCoolingDown).toBe(true);
    expect(result.current.cooldownSecondsLeft).toBe(15);

    // Advance remaining 15 seconds to finish the 60s cooldown
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(result.current.isCoolingDown).toBe(false);
    expect(result.current.cooldownSecondsLeft).toBe(0);
    expect(result.current.cooldownSeconds).toBe(0);

    // Now a subsequent resend call is allowed
    await act(async () => {
      await result.current.resend('student@example.com');
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
  });

  it('useResendVerification — server failure: never rejects, maps error via mapApiError, and does not start cooldown', async () => {
    const serverError = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(serverError);

    const { result } = renderHook(() => useResendVerification());

    // Must never reject
    await act(async () => {
      await expect(result.current.resend('student@example.com')).resolves.toBeUndefined();
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isCoolingDown).toBe(false);
    expect(result.current.cooldownSecondsLeft).toBe(0);
    expect(result.current.message).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.status).toBe(500);
    expect(result.current.error?.action).toBe('retry');
  });

  it('useResendVerification — server 429 rate limit: exposes 429 error and starts no cooldown', async () => {
    const rateLimitError = new ApiError(429, 'Too many requests, try again later', 'api');
    apiRequestSpy.mockRejectedValueOnce(rateLimitError);

    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend('student@example.com');
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isCoolingDown).toBe(false);
    expect(result.current.cooldownSecondsLeft).toBe(0);
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.status).toBe(429);
    expect(result.current.error?.message).toBe('Too many requests, try again later');
    expect(result.current.error?.action).toBe('none');
  });

  it('useResendVerification — ignores calls while pending (prevents concurrent requests)', async () => {
    let resolveRequest: (val: ApiResult<null>) => void;
    apiRequestSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    const { result } = renderHook(() => useResendVerification());

    let p1: Promise<void>;
    let p2: Promise<void>;

    act(() => {
      p1 = result.current.resend('student@example.com');
      p2 = result.current.resend('student@example.com');
    });

    expect(result.current.isPending).toBe(true);
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest!({
        statusCode: 200,
        message: 'Link sent',
        data: null,
      });
      await Promise.all([p1, p2]);
    });

    expect(result.current.isPending).toBe(false);
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useResendVerification — empty or whitespace email: does not call API', async () => {
    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend('');
    });
    expect(apiRequestSpy).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.resend('   ');
    });
    expect(apiRequestSpy).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('useResendVerification — unmount safety: does not update state after unmount and clears timer', async () => {
    let resolveRequest: (val: ApiResult<null>) => void;
    apiRequestSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    const { result, unmount } = renderHook(() => useResendVerification());

    act(() => {
      void result.current.resend('student@example.com');
    });

    // Unmount while request is in flight
    unmount();

    // Resolving request after unmount should not throw or cause warning
    await act(async () => {
      resolveRequest!({
        statusCode: 200,
        message: 'Link sent',
        data: null,
      });
    });

    // Advancing timers should not cause state update on unmounted component
    act(() => {
      vi.advanceTimersByTime(RESEND_COOLDOWN_MS);
    });
  });

  it('useResendVerification — unmount safety on rejection: does not update state after unmount when request rejects', async () => {
    let rejectRequest: (err: unknown) => void;
    apiRequestSpy.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        })
    );

    const { result, unmount } = renderHook(() => useResendVerification());

    act(() => {
      void result.current.resend('student@example.com');
    });

    unmount();

    await act(async () => {
      rejectRequest!(new ApiError(500, 'Server Error', 'api'));
    });
  });

  it('useResendVerification — unmount safety during active cooldown: clears timer and does not update state after unmount', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Link sent',
      data: null,
    });

    const { result, unmount } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend('student@example.com');
    });

    expect(result.current.isCoolingDown).toBe(true);

    // Unmount while cooldown timer interval is actively running
    unmount();

    // Advance time past cooldown duration
    act(() => {
      vi.advanceTimersByTime(RESEND_COOLDOWN_MS);
    });
  });

  it('useResendVerification — custom cooldownMs: respects custom cooldown duration option', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Link sent',
      data: null,
    });

    const { result } = renderHook(() => useResendVerification({ cooldownMs: 30_000 }));

    await act(async () => {
      await result.current.resend('student@example.com');
    });

    expect(result.current.isCoolingDown).toBe(true);
    expect(result.current.cooldownSecondsLeft).toBe(30);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.isCoolingDown).toBe(false);
    expect(result.current.cooldownSecondsLeft).toBe(0);
  });

  it('useResendVerification — background tab: handles expired cooldown when system time jumps past cooldown before interval ticks', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Link sent',
      data: null,
    });

    const { result } = renderHook(() => useResendVerification());

    await act(async () => {
      await result.current.resend('student@example.com');
    });

    expect(result.current.isCoolingDown).toBe(true);

    // System time jumps forward by 65s without running interval timers (background tab throttled timers)
    vi.setSystemTime(Date.now() + 65_000);

    // resend is called now
    await act(async () => {
      await result.current.resend('student@example.com');
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
  });

  it('useResendVerification — independent hook instances: each instance has its own cooldown', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Link sent',
      data: null,
    });

    const { result: hook1 } = renderHook(() => useResendVerification());
    const { result: hook2 } = renderHook(() => useResendVerification());

    await act(async () => {
      await hook1.current.resend('user1@example.com');
    });

    expect(hook1.current.isCoolingDown).toBe(true);
    expect(hook2.current.isCoolingDown).toBe(false);

    // hook2 can resend even while hook1 is cooling down
    await act(async () => {
      await hook2.current.resend('user2@example.com');
    });

    expect(hook2.current.isCoolingDown).toBe(true);
    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
  });
});
