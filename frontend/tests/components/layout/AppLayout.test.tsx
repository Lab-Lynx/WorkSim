// tests/components/layout/AppLayout.test.tsx

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import AppLayout from '@/components/layout/AppLayout';

type CurrentTicketState = {
  data: { id: string; code: string } | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

// Mutable state containers for dynamic mock returns
let logoutState: { mutate: Mock; isPending: boolean };
let currentTicketState: CurrentTicketState;

const mockLogoutMutate = vi.fn();

vi.mock('@/hooks/auth/useLogout', () => ({
  useLogout: () => logoutState,
}));

vi.mock('@/hooks/tickets/useCurrentTicket', () => ({
  useCurrentTicket: () => currentTicketState,
}));

vi.mock('@/components/layout/EmailVerificationBanner', () => ({
  EmailVerificationBanner: () => <div data-testid="email-verification-banner-component" />,
}));

vi.mock('@/components/layout/SubscriptionBanner', () => ({
  SubscriptionBanner: () => <div data-testid="subscription-banner-component" />,
}));

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    currentTicketState = {
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    };

    logoutState = {
      mutate: mockLogoutMutate,
      isPending: false,
    };
  });

  it('renders navigation links and main content', () => {
    render(
      <MemoryRouter>
        <AppLayout>
          <div data-testid="test-content">Test Content</div>
        </AppLayout>
      </MemoryRouter>
    );

    expect(screen.getByTestId('test-content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByTestId('email-verification-banner-component')).toBeInTheDocument();
    expect(screen.getByTestId('subscription-banner-component')).toBeInTheDocument();
  });

  it('collapses and expands the desktop sidebar', () => {
    render(
      <MemoryRouter>
        <AppLayout><div>Content</div></AppLayout>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /expand sidebar/i }));
    expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();
  });

  it('always shows Current Ticket in the sidebar', () => {
    currentTicketState = {
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    };

    render(
      <MemoryRouter>
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /current ticket/i })).toBeInTheDocument();
  });

  it('points Current Ticket at the active ticket when one exists', () => {
    currentTicketState = {
      data: { id: 'ticket-123', code: 'A12' },
      isLoading: false,
      isError: false,
      error: null,
    };

    render(
      <MemoryRouter>
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /current ticket/i })).toHaveAttribute(
      'href',
      '/tickets/ticket-123',
    );
  });

  it('keeps Current Ticket linked to the open ticket when the query errors', () => {
    currentTicketState = {
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Request failed'),
    };

    render(
      <MemoryRouter initialEntries={['/tickets/ticket-abc']}>
        <AppLayout>
          <div>Ticket Content</div>
        </AppLayout>
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: /current ticket/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/tickets/ticket-abc');
  });

  it('falls back Current Ticket to the dashboard when there is no active ticket', () => {
    currentTicketState = {
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('Request failed'),
    };

    render(
      <MemoryRouter>
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /current ticket/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('invokes useLogout and updates state on logout click', async () => {
    mockLogoutMutate.mockImplementation(
      (
        _data: unknown,
        options?: {
          onSuccess?: () => void;
          onError?: (error: { status?: number; message?: string }) => void;
        }
      ) => {
        options?.onSuccess?.();
      }
    );

    render(
      <MemoryRouter>
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      </MemoryRouter>
    );

    const logoutButtons = screen.getAllByRole('button', { name: /log out/i });
    fireEvent.click(logoutButtons[0]);

    expect(mockLogoutMutate).toHaveBeenCalled();
  });

  it('shows exact error message when logout mutation fails', async () => {
    mockLogoutMutate.mockImplementation(
      (
        _data: unknown,
        options?: {
          onSuccess?: () => void;
          onError?: (error: { status?: number; message?: string }) => void;
        }
      ) => {
        options?.onError?.({ status: 500, message: 'Server Error' });
      }
    );

    render(
      <MemoryRouter>
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      </MemoryRouter>
    );

    const logoutButtons = screen.getAllByRole('button', { name: /log out/i });
    fireEvent.click(logoutButtons[0]);

    expect(mockLogoutMutate).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent("Couldn't log out. Try again.");
    });
  });

  it('closes mobile Sheet drawer on route change / navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <AppLayout>
                <div data-testid="dashboard-content">Dashboard Content</div>
              </AppLayout>
            }
          />
          <Route path="/settings" element={<div>Navigated Target</div>} />
        </Routes>
      </MemoryRouter>
    );

    const openMenuButton = screen.getByRole('button', { name: /open navigation menu/i });
    fireEvent.click(openMenuButton);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const settingsLink = within(dialog).getByRole('link', { name: /settings/i });
    fireEvent.click(settingsLink);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
