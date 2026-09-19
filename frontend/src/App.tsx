import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useSessionBootstrap } from '@/hooks/useSessionBootstrap';
import router from '@/routes';

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
