import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import ErrorPage from '@/components/common/ErrorPage';
import { Button } from '@/components/ui/button';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-error';
import { captureClientError } from '@/lib/observability/sentry';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function reloadPage(): void {
  window.location.reload();
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    if (isChunkLoadError(error)) {
      reloadOnceForChunkError();
      return;
    }
    captureClientError(error, { componentStack: errorInfo.componentStack ?? '' });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (isChunkLoadError(error)) {
      return (
        <ErrorPage
          icon={RefreshCw}
          title="A new version is available"
          description="WorkSim was updated while this page was open. Reload to continue."
          actions={
            <Button type="button" onClick={reloadPage}>
              Reload page
            </Button>
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
}
