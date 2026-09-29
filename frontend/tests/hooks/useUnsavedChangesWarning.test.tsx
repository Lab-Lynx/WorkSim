import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMemoryRouter, RouterProvider, useNavigate, useLocation } from 'react-router-dom';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';

describe('useUnsavedChangesWarning hook (doc 10 §10.13; doc 11 §11.2.10 & §11.9)', { timeout: 30000 }, () => {
  let router: ReturnType<typeof createMemoryRouter>;

  function TestHarness({ isDirty }: { isDirty: boolean }) {
    const { isBlocked, confirmLeave, cancelLeave } = useUnsavedChangesWarning(isDirty);
    const navigate = useNavigate();
    const location = useLocation();

    return (
      <div>
        <div data-testid="current-pathname">{location.pathname}</div>
        <div data-testid="current-search">{location.search}</div>
        <div data-testid="current-hash">{location.hash}</div>
        <div data-testid="blocked-status">{isBlocked ? 'blocked' : 'unblocked'}</div>

        <button onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
        <button onClick={() => navigate(`${location.pathname}?tab=profile`)}>Change Search</button>
        <button onClick={() => navigate(`${location.pathname}#security`)}>Change Hash</button>
        <button
          onClick={() =>
            navigate('/login', {
              state: { notice: 'session_expired' },
            })
          }
        >
          Session Expired Redirect
        </button>
        <button onClick={() => navigate('/login')}>Logout to Login</button>

        {isBlocked && (
          <div data-testid="confirm-dialog">
            <p>You have unsaved changes.</p>
            <button onClick={confirmLeave}>Leave</button>
            <button onClick={cancelLeave}>Stay</button>
          </div>
        )}
      </div>
    );
  }

  function renderWithRouter(initialIsDirty: boolean) {
    let currentIsDirty = initialIsDirty;

    function Root() {
      return <TestHarness isDirty={currentIsDirty} />;
    }

    router = createMemoryRouter(
      [
        { path: '/settings', element: <Root /> },
        { path: '/dashboard', element: <div data-testid="dashboard-page">Dashboard</div> },
        { path: '/login', element: <div data-testid="login-page">Login Page</div> },
      ],
      {
        initialEntries: ['/settings'],
      }
    );

    const utils = render(<RouterProvider router={router} />);

    return {
      ...utils,
      setDirty: (dirty: boolean) => {
        currentIsDirty = dirty;
        act(() => {
          router.navigate('/settings', { replace: true });
        });
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    router?.dispose();
    vi.restoreAllMocks();
  });

  it('useUnsavedChangesWarning — dirty navigation: blocks navigation to a different pathname and exposes confirm/cancel controls (Doc 10 §10.13, Doc 11 §11.2.10)', async () => {
    renderWithRouter(true);

    expect(screen.getByTestId('blocked-status').textContent).toBe('unblocked');
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

    // Attempt to navigate to /dashboard
    fireEvent.click(screen.getByRole('button', { name: 'Go to Dashboard' }));

    // Navigation should be blocked
    await waitFor(() => {
      expect(screen.getByTestId('blocked-status').textContent).toBe('blocked');
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('current-pathname').textContent).toBe('/settings');
    });

    // Click "Stay" (cancelLeave)
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));

    await waitFor(() => {
      expect(screen.getByTestId('blocked-status').textContent).toBe('unblocked');
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('current-pathname').textContent).toBe('/settings');
    });

    // Attempt to navigate again
    fireEvent.click(screen.getByRole('button', { name: 'Go to Dashboard' }));
    await waitFor(() => {
      expect(screen.getByTestId('blocked-status').textContent).toBe('blocked');
    });

    // Click "Leave" (confirmLeave)
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));

    // Navigation should proceed
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  it('useUnsavedChangesWarning — query/hash only: does not block search or hash changes (Doc 10 §10.13, Doc 11 §11.2.10)', () => {
    renderWithRouter(true);

    // Change search params only
    fireEvent.click(screen.getByRole('button', { name: 'Change Search' }));
    expect(screen.getByTestId('blocked-status').textContent).toBe('unblocked');
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('current-pathname').textContent).toBe('/settings');
    expect(screen.getByTestId('current-search').textContent).toBe('?tab=profile');

    // Change hash only
    fireEvent.click(screen.getByRole('button', { name: 'Change Hash' }));
    expect(screen.getByTestId('blocked-status').textContent).toBe('unblocked');
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('current-pathname').textContent).toBe('/settings');
    expect(screen.getByTestId('current-hash').textContent).toBe('#security');
  });

  it('useUnsavedChangesWarning — session expiry: does not block session-expiry redirect to /login (Doc 6 A-53, Doc 10 §10.13)', () => {
    renderWithRouter(true);

    fireEvent.click(screen.getByRole('button', { name: 'Session Expired Redirect' }));

    // Must not be blocked; navigates to /login
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('useUnsavedChangesWarning — logout: blocks normal navigation to /login without session_expired state (Doc 10 §10.13)', () => {
    renderWithRouter(true);

    fireEvent.click(screen.getByRole('button', { name: 'Logout to Login' }));

    // Must be blocked because it's not a session expiry redirect
    expect(screen.getByTestId('blocked-status').textContent).toBe('blocked');
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('useUnsavedChangesWarning — not dirty: never blocks navigation when isDirty is false', () => {
    renderWithRouter(false);

    fireEvent.click(screen.getByRole('button', { name: 'Go to Dashboard' }));

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('useUnsavedChangesWarning — beforeunload: calls preventDefault and sets returnValue to empty string when dirty (Doc 10 §10.13, Doc 11 §11.2.10)', () => {
    renderWithRouter(true);

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    let assignedReturnValue: unknown;
    Object.defineProperty(event, 'returnValue', {
      get: () => assignedReturnValue,
      set: (val: unknown) => {
        assignedReturnValue = val;
      },
    });

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(assignedReturnValue).toBe('');
  });

  it('useUnsavedChangesWarning — beforeunload: does not prevent unload when not dirty', () => {
    renderWithRouter(false);

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    let assignedReturnValue: unknown;
    Object.defineProperty(event, 'returnValue', {
      get: () => assignedReturnValue,
      set: (val: unknown) => {
        assignedReturnValue = val;
      },
    });

    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(assignedReturnValue).toBeUndefined();
  });

  it('useUnsavedChangesWarning — cleanup: removes beforeunload listener on unmount (Doc 10 §10.13, Doc 11 §11.2.10)', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderWithRouter(true);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    // Dispatch event after unmount
    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});
