import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import router from '@/routes';
import { configureApiClient } from '@/lib/api/client';
import { configureApiClient as configureLegacyApiClient } from '@/lib/axios';
import { env } from '@/config/env';
import { queryKeys } from '@/lib/query-keys';
import { buildLoginRedirect } from '@/lib/navigation';
import { ApplyStoredTheme } from '@/components/common/ThemeToggle';
import { Assistant } from '@/components/Assistant';

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
}

configureApiClient({
  baseUrl: env.VITE_API_URL,
  onSessionExpired,
});

configureLegacyApiClient({
  baseUrl: env.VITE_API_URL,
  onSessionExpired,
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ApplyStoredTheme />
        <RouterProvider router={router} />
        <Assistant />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
