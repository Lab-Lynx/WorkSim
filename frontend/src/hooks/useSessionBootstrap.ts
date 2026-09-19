import { useEffect } from 'react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';

/**
 * Runs once on app start to find out whether the httpOnly session cookie is
 * still valid, and syncs `user` accordingly. This has to live outside
 * useAuth() because useAuth() calls useNavigate(), which requires being
 * inside the router — and this needs to run *before* the router decides
 * whether to show a protected page or redirect to /login.
 *
 * Returns whether the check has completed, so the app can show a loading
 * state instead of flashing the login page for a split second on every
 * hard refresh (see App.tsx).
 */
export function useSessionBootstrap(): boolean {
  const isSessionChecked = useAuthStore((s) => s.isSessionChecked);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const markSessionChecked = useAuthStore((s) => s.markSessionChecked);

  useEffect(() => {
    if (isSessionChecked) return;

    api
      .get<User>('/auth/me')
      .then(({ data }) => setUser(data))
      .catch(() => clearAuth())
      .finally(() => markSessionChecked());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isSessionChecked;
}
