import { useAuthStore } from '@/store/auth.store';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/api/client';
import { ROUTES } from '@/constants';
import type { LoginCredentials, User } from '@/types';

export function useAuth() {
  const { user, setUser, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const login = async (credentials: LoginCredentials) => {
    const res = await apiRequest<{ user: User }>('POST', '/auth/login', {
      body: credentials,
    });
    setUser(res.data.user);
    navigate(ROUTES.DASHBOARD);
  };

  const logout = async () => {
    await apiRequest<null>('POST', '/auth/logout').catch(() => {});
    clearAuth();
    navigate(ROUTES.LOGIN);
  };

  return { user, isAuthenticated: !!user, login, logout };
}
