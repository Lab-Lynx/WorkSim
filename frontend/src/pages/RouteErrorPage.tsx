import { useEffect, useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Compass, RefreshCw, TriangleAlert } from 'lucide-react';
import ErrorPage from '@/components/common/ErrorPage';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { canReloadForChunkError, isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-error';

function reloadPage(): void {
  window.location.reload();
}

export default function RouteErrorPage(): React.JSX.Element {
  const error = useRouteError();
  const isChunkError = isChunkLoadError(error);
  const [isReloading] = useState(() => isChunkError && canReloadForChunkError());

  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  useDocumentTitle(isNotFound ? 'Page not found' : 'Something went wrong');

  useEffect(() => {
    if (!isNotFound) console.error('Route error:', error);
    if (isReloading) reloadOnceForChunkError();
  }, [error, isReloading, isNotFound]);

  if (isNotFound) {
    return (
      <ErrorPage
        icon={Compass}
        code="404"
        title="Page not found"
        description="The page you are looking for does not exist or may have moved."
        actions={
          <Button asChild>
            <a href="/">Go to home</a>
          </Button>
        }
      />
    );
  }

  if (isChunkError) {
    return (
      <ErrorPage
        icon={RefreshCw}
        title={isReloading ? 'Updating WorkSim...' : 'A new version is available'}
        description={
          isReloading
            ? 'Loading the latest version. This will only take a moment.'
            : 'WorkSim was updated while this page was open. Reload to continue.'
        }
        actions={
          !isReloading && (
            <Button type="button" onClick={reloadPage}>
              Reload page
            </Button>
          )
        }
      />
    );
  }

  return (
    <ErrorPage
      icon={TriangleAlert}
      title="Something went wrong"
      description="An unexpected error occurred. Please retry. Your work is safe."
      actions={
        <>
          <Button type="button" onClick={reloadPage}>
            Try again
          </Button>
          <Button asChild variant="outline">
            <a href="/">Go to home</a>
          </Button>
        </>
      }
    />
  );
}
