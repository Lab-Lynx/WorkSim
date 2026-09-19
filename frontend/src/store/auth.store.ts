import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  /** True once the initial /auth/me check (see useSessionBootstrap) has run. */
  isSessionChecked: boolean;
  setUser: (user: User) => void;
  clearAuth: () => void;
  markSessionChecked: () => void;
}

/**
 * The actual access/refresh tokens live only in httpOnly cookies set by the
 * backend — never in this store, and never readable by JS. That's the
 * whole point: it keeps them safe from theft via an XSS bug, unlike the
 * previous localStorage approach.
 *
 * `user` here is a client-side convenience for rendering the UI without a
 * flash of "logged out" — it is NOT the source of truth for whether someone
 * is actually authenticated. The cookie + backend decide that. On app load,
 * `useSessionBootstrap` calls GET /auth/me to confirm the cookie is still
 * valid and resync this value (a persisted `user` from a previous visit
 * could be stale if the session expired or was revoked elsewhere).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isSessionChecked: false,
      setUser: (user) => set({ user }),
      clearAuth: () => set({ user: null }),
      markSessionChecked: () => set({ isSessionChecked: true }),
    }),
    {
      name: 'auth-storage',
      // Never persist isSessionChecked — every fresh page load must
      // re-verify against the backend, not trust an old flag.
      partialize: (state) => ({ user: state.user }),
    }
  )
);
