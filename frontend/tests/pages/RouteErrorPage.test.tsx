import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RouteErrorPage from '@/pages/RouteErrorPage';

function renderWithRouteError(thrown: () => never, path = '/boom') {
  const router = createMemoryRouter(
    [
      {
        path,
        loader: () => {
          thrown();
        },
        element: <div>ok</div>,
        errorElement: <RouteErrorPage />,
      },
    ],
    { initialEntries: [path] }
  );
  return render(<RouterProvider router={router} />);
}

describe('RouteErrorPage', () => {
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

  it('shows a retry page for unexpected errors without leaking the error', async () => {
    renderWithRouteError(() => {
      throw new Error('secret internal detail');
    });

    expect(await screen.findByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.queryByText(/secret internal detail/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to home/i })).toHaveAttribute('href', '/');
  });

  it('reloads automatically once for a stale chunk error', async () => {
    renderWithRouteError(() => {
      throw new TypeError('Failed to fetch dynamically imported module: /assets/RegisterPage-x.js');
    });

    expect(await screen.findByRole('heading', { name: /updating worksim/i })).toBeInTheDocument();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('offers a manual reload when the automatic reload was already used', async () => {
    sessionStorage.setItem('worksim:chunk-reload-at', String(Date.now()));
    renderWithRouteError(() => {
      throw new TypeError('Failed to fetch dynamically imported module: /assets/RegisterPage-x.js');
    });

    expect(await screen.findByRole('heading', { name: /new version is available/i })).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
  });

  it('shows the 404 view for a not-found route response', async () => {
    renderWithRouteError(() => {
      throw new Response('Not found', { status: 404 });
    });

    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });
});
