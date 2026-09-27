import { Navigate } from "react-router-dom";
import { useMe } from "@/hooks/auth/useMe";
import FullPageLoader from "@/components/layout/FullPageLoader";

/**
 * Root redirect handler for '/'.
 * There is no landing page in V1 (Doc 6 A-38).
 *
 * Spec: Doc 10 §10.14 (FE-066)
 * - Pending: FullPageLoader
 * - Success: Navigate to /dashboard with replace
 * - Error: Navigate to /login with replace (no 'from')
 */
export function RootRedirect() {
    const { isPending, isSuccess } = useMe();

    if (isPending) {
        return <FullPageLoader />;
    }

    if (isSuccess) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Navigate to="/login" replace />;
}

export default RootRedirect;
