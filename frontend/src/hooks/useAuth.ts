import { useAuthStore } from '@/store/auth.store';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { ROUTES } from '@/constants';
import type { LoginCredentials, User } from '@/types';

export function useAuth() {
  const { user, setUser, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const login = async (credentials: LoginCredentials) => {
    // The backend sets the access/refresh tokens as httpOnly cookies on
    // this response. Nothing token-related comes back in the body — that's
    // intentional, see lib/axios.ts.
    const { data } = await api.post<{ user: User }>('/auth/login', credentials);
    setUser(data.user);
    navigate(ROUTES.HOME);
  };

  const logout = async () => {
    // Best-effort: even if this fails (e.g. already-expired session),
    // still clear local state and navigate away.
    await api.post('/auth/logout').catch(() => {});
    clearAuth();
    navigate(ROUTES.LOGIN);
  };

  return { user, isAuthenticated: !!user, login, logout };
}
