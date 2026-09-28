/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ProtectedRoute from './ProtectedRoute';
import PublicRoute from './PublicRoute';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import { ROUTES } from '@/constants';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
    </div>
  );
}

// Wrap each lazy element so Suspense boundaries stay per-page,
// matching the granularity your original Suspense had.
const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
);

const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: ROUTES.LOGIN, element: withSuspense(<LoginPage />) },
          { path: ROUTES.REGISTER, element: withSuspense(<RegisterPage />) },
          { path: ROUTES.FORGOT_PASSWORD, element: withSuspense(<ForgotPasswordPage />) },
          { path: ROUTES.RESET_PASSWORD, element: withSuspense(<ResetPasswordPage />) },
          { path: ROUTES.VERIFY_EMAIL, element: withSuspense(<VerifyEmailPage />) },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: ROUTES.HOME, element: withSuspense(<DashboardPage />) },
          { path: ROUTES.DASHBOARD, element: withSuspense(<DashboardPage />) },
        ],
      },
    ],
  },
  { path: '*', element: withSuspense(<NotFoundPage />) },
]);

export default router;