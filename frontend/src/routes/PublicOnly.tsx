import type { ReactNode } from "react";
import { Navigate, Outlet, useSearchParams } from "react-router-dom";
import { useMe } from "@/hooks/auth/useMe";
import FullPageLoader from "@/components/layout/FullPageLoader";
import { getSafeRedirectPath } from "@/lib/navigation";

export interface PublicOnlyProps {
    children?: ReactNode;
}

/**
 * Route guard that prevents authenticated users from accessing public-only pages
 * such as /login, /register, and /forgot-password.
 *
 * Spec: Doc 10 §10.14 (FE-065)
 * - Pending: FullPageLoader
 * - Success (authenticated): Navigate with replace to getSafeRedirectPath(from, '/dashboard')
 * - Error (401 or network error): renders children / Outlet
 */
export function PublicOnly({ children }: PublicOnlyProps) {
    const { isPending, isSuccess } = useMe();
    const [searchParams] = useSearchParams();

    if (isPending) {
        return <FullPageLoader />;
    }

    if (isSuccess) {
        const from = searchParams.get("from");
        const destination = getSafeRedirectPath(from, "/dashboard");
        return <Navigate to={destination} replace />;
    }

    return children ? <>{children}</> : <Outlet />;
}

export default PublicOnly;
