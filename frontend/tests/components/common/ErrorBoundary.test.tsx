import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '@/components/common/ErrorBoundary';

function Thrower({ error }: { error: Error }): React.JSX.Element {
  throw error;
}

describe('ErrorBoundary', () => {
  const reload = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    vi.stubGlobal('location', { ...window.location, reload });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('shows a friendly retry page for render errors', () => {
    render(
      <ErrorBoundary>
        <Thrower error={new Error('kaboom')} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.queryByText(/kaboom/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('prompts for a reload and auto-reloads once on a stale chunk error', () => {
    render(
      <ErrorBoundary>
        <Thrower error={new TypeError('Failed to fetch dynamically imported module: /assets/a.js')} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: /new version is available/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
