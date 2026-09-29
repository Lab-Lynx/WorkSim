import { useState, useRef, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api/client';
import { mapApiError, type UiError } from '@/lib/api/errors';
import { RESEND_COOLDOWN_MS } from '@/config/app.config';

export type ResendError = UiError;

export interface ResendVerificationState {
  resend: (email: string) => Promise<void>;
  isPending: boolean;
  isCoolingDown: boolean;
  cooldownSecondsLeft: number;
  cooldownSeconds: number;
  message: string | null;
  error: UiError | null;
}

export interface UseResendVerificationOptions {
  cooldownMs?: number;
}

export function useResendVerification(
  options?: UseResendVerificationOptions
): ResendVerificationState {
  const [isPending, setIsPending] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  const isMountedRef = useRef(true);
  const isPendingRef = useRef(false);
  const cooldownUntilRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cooldownDuration = options?.cooldownMs ?? RESEND_COOLDOWN_MS;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const resend = useCallback(
    async (email: string): Promise<void> => {
      if (!email || !email.trim()) {
        return;
      }

      const now = Date.now();
      if (cooldownUntilRef.current !== null) {
        if (now < cooldownUntilRef.current) {
          return;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        cooldownUntilRef.current = null;
        if (isMountedRef.current) {
          setIsCoolingDown(false);
          setCooldownSecondsLeft(0);
        }
      }

      if (isPendingRef.current) {
        return;
      }

      isPendingRef.current = true;
      if (isMountedRef.current) {
        setIsPending(true);
        setError(null);
      }

      try {
        const response = await apiRequest<null>('POST', '/auth/resend-verification', {
          body: { email: email.trim() },
        });

        if (!isMountedRef.current) {
          return;
        }

        setMessage(response.message);
        setError(null);

        const targetCooldownUntil = Date.now() + cooldownDuration;
        cooldownUntilRef.current = targetCooldownUntil;
        setIsCoolingDown(true);
        setCooldownSecondsLeft(Math.max(0, Math.ceil(cooldownDuration / 1000)));

        timerRef.current = setInterval(() => {
          const currentNow = Date.now();
          const remainingMs =
            cooldownUntilRef.current !== null ? cooldownUntilRef.current - currentNow : 0;
          const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));

          if (secondsLeft <= 0) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            cooldownUntilRef.current = null;
            if (isMountedRef.current) {
              setIsCoolingDown(false);
              setCooldownSecondsLeft(0);
            }
          } else {
            if (isMountedRef.current) {
              setCooldownSecondsLeft(secondsLeft);
            }
          }
        }, 1000);
      } catch (err: unknown) {
        if (!isMountedRef.current) {
          return;
        }
        const uiError = mapApiError(err);
        setError(uiError);
        setMessage(null);
      } finally {
        isPendingRef.current = false;
        if (isMountedRef.current) {
          setIsPending(false);
        }
      }
    },
    [cooldownDuration]
  );

  return {
    resend,
    isPending,
    isCoolingDown,
    cooldownSecondsLeft,
    cooldownSeconds: cooldownSecondsLeft,
    message,
    error,
  };
}
