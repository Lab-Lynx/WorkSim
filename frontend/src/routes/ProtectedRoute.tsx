import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { buildLoginRedirect } from '@/lib/navigation';
import { isSessionExpiredGuardActive } from '@/lib/axios';

export default function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const currentPath = location.pathname + location.search + location.hash;

  if (isSessionExpiredGuardActive()) {
    return null;
  }

  return user ? <Outlet /> : <Navigate to={buildLoginRedirect(currentPath)} replace />;
}
