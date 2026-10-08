/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
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
    <div className="space-y-6 py-2" role="status" aria-label="Loading page">
      <div className="h-8 w-1/4 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-48 w-full animate-pulse rounded-xl bg-muted/60" />
        <div className="h-48 w-full animate-pulse rounded-xl bg-muted/60" />
      </div>
      <div className="h-64 w-full animate-pulse rounded-xl bg-muted/60" />
    </div>
  );
}

function AuthLoader() {
  return (
    <div className="flex h-svh w-full items-center justify-center bg-background" role="status" aria-label="Loading page">
      <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
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
    element: <Suspense fallback={<div className="min-h-screen bg-[#F5F5F5]" />}><LandingPage /></Suspense>,
  },
  {
    element: <PublicOnly />,
    children: [
      {
        element: (
          <Suspense fallback={<AuthLoader />}>
            <AuthLayout />
          </Suspense>
        ),
        children: [
          { path: ROUTES.LOGIN, element: <LoginPage /> },
          { path: ROUTES.REGISTER, element: <RegisterPage /> },
          { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
        ],
      },
    ],
  },
  {
    element: (
      <Suspense fallback={<AuthLoader />}>
        <AuthLayout />
      </Suspense>
    ),
    children: [
      { path: ROUTES.RESET_PASSWORD, element: <ResetPasswordPage /> },
      { path: ROUTES.VERIFY_EMAIL, element: <VerifyEmailPage /> },
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
