import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotFoundPage from '@/pages/NotFoundPage';
import { useMe } from '@/hooks/auth/useMe';

vi.mock('@/hooks/auth/useMe');
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));
vi.mock('@/components/layout/AuthLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-layout">{children}</div>,
}));

describe('NotFoundPage (FE-100)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the full-page loader while the session is pending', () => {
    vi.mocked(useMe).mockReturnValue({ data: undefined, isPending: true } as never);
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByRole('status', { name: /loading application/i })).toBeInTheDocument();
  });

  it('uses AppLayout and links authenticated users to the dashboard', () => {
    vi.mocked(useMe).mockReturnValue({ data: { id: 'user-1', name: 'Student' }, isPending: false } as never);
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('uses AuthLayout and links logged-out users to login', () => {
    vi.mocked(useMe).mockReturnValue({ data: undefined, isPending: false, isError: true } as never);
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByTestId('auth-layout')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/login');
  });
});