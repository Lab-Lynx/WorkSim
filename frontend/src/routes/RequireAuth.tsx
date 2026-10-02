import type { ReactNode } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useMe } from '@/hooks/auth/useMe';
import FullPageLoader from '@/components/layout/FullPageLoader';
import ErrorState from '@/components/common/ErrorState';
import { buildLoginRedirect } from '@/lib/navigation';

export interface RequireAuthProps {
    children?: ReactNode;
}

/**
 * TEMP: set to `false` before shipping — skips auth so UI work can hit
 * /dashboard, /billing, etc. without a session.
 */
export const BYPASS_AUTH_FOR_UI = false;

/**
 * FE-064: Protected route guard for PG-06 through PG-12 (doc 10 §10.14).
 * Only useMe decides whether a user is authenticated (no direct cookie reads).
 * - Pending: FullPageLoader
 * - 401 Error: redirect to buildLoginRedirect(pathname + search) with replace (no session expired notice on first load)
 * - Network/5xx/other error: centered ErrorState with a Retry button that calls refetch
 * - Success: children (or Outlet)
 */
export default function RequireAuth({ children }: RequireAuthProps) {
    const { data: user, isPending, error, refetch } = useMe();
    const location = useLocation();

    if (BYPASS_AUTH_FOR_UI) {
        return <>{children ?? <Outlet />}</>;
    }

    if (isPending) {
        return <FullPageLoader />;
    }

    if (error) {
        if (error.status === 401) {
            const currentPath = location.pathname + location.search;
            return <Navigate to={buildLoginRedirect(currentPath)} replace />;
        }

        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <ErrorState
                    message={error.message || 'Failed to load user session. Please try again.'}
                    onRetry={() => refetch()}
                    retryLabel="Retry"
                />
            </div>
        );
    }

    if (!user) {
        const currentPath = location.pathname + location.search;
        return <Navigate to={buildLoginRedirect(currentPath)} replace />;
    }

    return <>{children ?? <Outlet />}</>;
}
