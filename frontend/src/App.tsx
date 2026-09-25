import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useSessionBootstrap } from '@/hooks/useSessionBootstrap';
import router from '@/routes';
import { configureApiClient } from '@/lib/axios';
import { env } from '@/config/env';
import { queryKeys } from '@/lib/query-keys';
import { buildLoginRedirect } from '@/lib/navigation';
import { useAuthStore } from '@/store/auth.store';

function onSessionExpired(): void {
  if (!queryClient.getQueryData(queryKeys.me)) {
    return;
  }

  const location = router.state?.location;
  const currentPath = location
    ? location.pathname + location.search + location.hash
    : window.location.pathname + window.location.search + window.location.hash;

  router.navigate(buildLoginRedirect(currentPath), {
    replace: true,
    state: { notice: 'session_expired' },
  });

  queryClient.clear();
  useAuthStore.getState().clearAuth();
}

configureApiClient({
  baseUrl: env.VITE_API_URL,
  onSessionExpired,
});

function App() {
  // The auth token lives in an httpOnly cookie now (not readable by JS),
  // so on every fresh load we don't actually know if the user is logged in
  // until we ask the backend. Wait for that one check before rendering the
  // router, or a logged-in user would flash the login page for a moment on
  // every hard refresh.
  const sessionChecked = useSessionBootstrap();

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
