import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GuestLoginButton from '@/components/auth/GuestLoginButton';
import * as apiClient from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';

const guestUser: User = {
  id: 'usr-guest',
  name: 'Guest',
  email: 'guest@example.com',
  role: 'student',
  emailVerifiedAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
};

function renderButton(queryClient: QueryClient, initialEntry = '/login') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<GuestLoginButton />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-page" />} />
          <Route path="/tickets/:id" element={<div data-testid="ticket-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('GuestLoginButton', () => {
  let queryClient: QueryClient;
  let apiRequestSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when guest login is not enabled on the server', async () => {
    apiRequestSpy.mockResolvedValue({ data: { enabled: false } } as never);
    renderButton(queryClient);

    await waitFor(() => expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/auth/guest', expect.anything()));
    expect(screen.queryByRole('button', { name: /continue as guest/i })).not.toBeInTheDocument();
  });

  it('renders nothing when the availability check fails', async () => {
    apiRequestSpy.mockRejectedValue(new Error('network'));
    renderButton(queryClient);

    await waitFor(() => expect(apiRequestSpy).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /continue as guest/i })).not.toBeInTheDocument();
  });

  it('signs in as guest, stores the user and navigates to the dashboard', async () => {
    apiRequestSpy.mockImplementation((async (method: string) =>
      method === 'GET' ? { data: { enabled: true } } : { data: { user: guestUser } }) as never);
    renderButton(queryClient);

    fireEvent.click(await screen.findByRole('button', { name: /continue as guest/i }));

    expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument();
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/guest', expect.anything());
    expect(useAuthStore.getState().user).toEqual(guestUser);
  });

  it('honours a safe ?from= redirect after guest sign-in', async () => {
    apiRequestSpy.mockImplementation((async (method: string) =>
      method === 'GET' ? { data: { enabled: true } } : { data: { user: guestUser } }) as never);
    renderButton(queryClient, '/login?from=%2Ftickets%2Fabc');

    fireEvent.click(await screen.findByRole('button', { name: /continue as guest/i }));

    expect(await screen.findByTestId('ticket-page')).toBeInTheDocument();
  });

  it('shows an error and stays on the page when guest sign-in fails', async () => {
    apiRequestSpy.mockImplementation((async (method: string) => {
      if (method === 'GET') return { data: { enabled: true } };
      throw new Error('boom');
    }) as never);
    renderButton(queryClient);

    fireEvent.click(await screen.findByRole('button', { name: /continue as guest/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
