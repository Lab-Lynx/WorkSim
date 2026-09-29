import { useCallback, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export interface UseUnsavedChangesWarningResult {
  isBlocked: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
}

/**
 * useUnsavedChangesWarning — Doc 6 §6.5.6 & Doc 10 §10.13.
 * Asks before the user leaves a dirty form (Settings page only).
 *
 * Rules:
 * - While isDirty is true: registers router navigation blocker and beforeunload listener.
 * - Both are removed when isDirty becomes false or component unmounts.
 * - In-app navigation to a different pathname sets isBlocked to true.
 * - confirmLeave lets navigation continue; cancelLeave cancels it.
 * - A change that only alters query string or hash is never blocked.
 * - Navigation to /login caused by session expiry (state notice: 'session_expired') is never blocked (A-53).
 * - beforeunload calls event.preventDefault() and sets event.returnValue = ''.
 */
export function useUnsavedChangesWarning(
  isDirty: boolean
): UseUnsavedChangesWarningResult {
  const shouldBlock = useCallback(
    ({
      currentLocation,
      nextLocation,
    }: {
      currentLocation: { pathname: string };
      nextLocation: { pathname: string; state?: unknown };
    }) => {
      if (!isDirty) {
        return false;
      }

      // Never block navigation that alters only query string or hash
      if (nextLocation.pathname === currentLocation.pathname) {
        return false;
      }

      // Never block navigation caused by session expiry (Doc 6 A-53)
      const state = nextLocation.state as { notice?: string } | null | undefined;
      if (state?.notice === 'session_expired') {
        return false;
      }

      return true;
    },
    [isDirty]
  );

  const blocker = useBlocker(shouldBlock);

  // If isDirty becomes false while blocked, reset the blocker
  useEffect(() => {
    if (!isDirty && blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [isDirty, blocker]);

  // Handle browser tab close or refresh
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const confirmLeave = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }, [blocker]);

  const cancelLeave = useCallback(() => {
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  return {
    isBlocked: blocker.state === 'blocked',
    confirmLeave,
    cancelLeave,
  };
}
