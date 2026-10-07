/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import RequireAuth from './RequireAuth';
import PublicOnly from './PublicOnly';
import AppLayout from '@/components/layout/AppLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import NotFoundPage from '@/pages/NotFoundPage';
import RouteErrorPage from '@/pages/RouteErrorPage';
import { ROUTES } from '@/constants';
import { useCurrentTicket } from '@/hooks/tickets/useCurrentTicket';
import GetTicketPanel from '@/components/ticket/GetTicketPanel';

const LandingPage = lazy(() => import('@/pages/public/LandingPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));
const BillingPage = lazy(() => import('@/pages/billing/BillingPage'));
const CheckoutReturnPage = lazy(() => import('@/pages/billing/CheckoutReturnPage'));
const GitHubSetupPage = lazy(() => import('@/pages/github/GitHubSetupPage'));
const TicketPage = lazy(() => import('@/pages/tickets/TicketPage'));
const ProfilePage = lazy(() => import('@/pages/profile/ExperienceProfilePage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const SubmissionsPage = lazy(() => import('@/pages/submissions/SubmissionsPage'));

function TicketRoute() {
  const { ticketId } = useParams();
  const { data: currentTicket, isLoading } = useCurrentTicket({
    enabled: ticketId === 'current' || !ticketId,
  });

  if (ticketId === 'current' || !ticketId) {
    if (isLoading) return <PageLoader />;
    if (currentTicket) return <Navigate to={`/tickets/${currentTicket.id}`} replace />;
    return <GetTicketPanel />;
  }

  return withSuspense(<TicketPage key={ticketId} />);
}

function PaymentReturnAlias() {
  const { search } = useLocation();
  return <Navigate to={`${ROUTES.BILLING_RETURN}${search}`} replace />;
}

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center" role="status">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
    </div>
  );
}

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
);

const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
  {
    path: ROUTES.HOME,
    element: withSuspense(<LandingPage />),
  },
  {
    element: <PublicOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: ROUTES.LOGIN, element: withSuspense(<LoginPage />) },
          { path: ROUTES.REGISTER, element: withSuspense(<RegisterPage />) },
          { path: ROUTES.FORGOT_PASSWORD, element: withSuspense(<ForgotPasswordPage />) },
        ],
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: ROUTES.RESET_PASSWORD, element: withSuspense(<ResetPasswordPage />) },
      { path: ROUTES.VERIFY_EMAIL, element: withSuspense(<VerifyEmailPage />) },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout><Outlet /></AppLayout>,
        children: [
          { path: ROUTES.DASHBOARD, element: withSuspense(<DashboardPage />) },
          { path: ROUTES.BILLING, element: withSuspense(<BillingPage />) },
          { path: ROUTES.BILLING_RETURN, element: withSuspense(<CheckoutReturnPage />) },
          { path: ROUTES.PAYMENT_RETURN_ALIAS, element: <PaymentReturnAlias /> },
          { path: ROUTES.GITHUB, element: withSuspense(<GitHubSetupPage />) },
          { path: '/tickets', element: <TicketRoute /> },
          { path: ROUTES.TICKET, element: <TicketRoute /> },
          { path: ROUTES.PROFILE, element: withSuspense(<ProfilePage />) },
          { path: ROUTES.SUBMISSIONS, element: withSuspense(<SubmissionsPage />) },
          { path: ROUTES.SETTINGS, element: withSuspense(<SettingsPage />) },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default router;
