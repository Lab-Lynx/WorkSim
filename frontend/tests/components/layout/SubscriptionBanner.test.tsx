import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SubscriptionBanner } from '@/components/layout/SubscriptionBanner';
import { vi } from 'vitest';

vi.mock('@/hooks/billing/useSubscription', () => ({
  useSubscription: vi.fn(),
}));

import { useSubscription } from '@/hooks/billing/useSubscription';

const mockSubscriptionData = (data: unknown) => {
  vi.mocked(useSubscription).mockReturnValue({ data } as unknown as ReturnType<typeof useSubscription>);
};

describe('SubscriptionBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there is no subscription data or banner is not required', () => {
    mockSubscriptionData({
      subscription: {
        id: 'sub_1',
        status: 'active',
        currentPeriodStart: '2026-01-01T00:00:00Z',
        currentPeriodEnd: '2026-02-01T00:00:00Z',
        cancelAtPeriodEnd: false,
      },
      hasAccess: true,
    });

    const { container } = render(
      <MemoryRouter>
        <SubscriptionBanner />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders canceled subscription banner with access expiration date', () => {
    mockSubscriptionData({
      subscription: {
        id: 'sub_1',
        status: 'canceled',
        currentPeriodStart: '2026-01-01T00:00:00Z',
        currentPeriodEnd: '2026-02-01T00:00:00Z',
        cancelAtPeriodEnd: true,
      },
      hasAccess: true,
    });

    render(
      <MemoryRouter>
        <SubscriptionBanner />
      </MemoryRouter>
    );

    expect(screen.getByRole('region', { name: /subscription banner/i })).toBeInTheDocument();
    expect(screen.getByText(/your subscription has been canceled/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Feb 2026/i)).toBeInTheDocument();
  });

  it('renders ended subscription banner when access has expired', () => {
    mockSubscriptionData({
      subscription: {
        id: 'sub_1',
        status: 'canceled',
        currentPeriodStart: '2026-01-01T00:00:00Z',
        currentPeriodEnd: '2026-01-15T00:00:00Z',
        cancelAtPeriodEnd: true,
      },
      hasAccess: false,
    });

    render(
      <MemoryRouter>
        <SubscriptionBanner />
      </MemoryRouter>
    );

    expect(screen.getByRole('region', { name: /subscription banner/i })).toBeInTheDocument();
    expect(screen.getByText(/your subscription has ended/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /renew/i })).toHaveAttribute('href', '/billing');
  });

  it('handles past_due subscriptions according to Q-15 with no payment action button', () => {
    mockSubscriptionData({
      subscription: {
        id: 'sub_1',
        status: 'past_due',
        currentPeriodStart: '2026-01-01T00:00:00Z',
        currentPeriodEnd: '2026-02-01T00:00:00Z',
        cancelAtPeriodEnd: false,
      },
      hasAccess: true,
    });

    render(
      <MemoryRouter>
        <SubscriptionBanner />
      </MemoryRouter>
    );

    expect(screen.getByRole('region', { name: /subscription banner/i })).toBeInTheDocument();
    expect(screen.getByText(/payment past due/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pay now/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry payment/i })).not.toBeInTheDocument();
  });

  it('meets accessibility conventions with alert role and region labeling', () => {
    mockSubscriptionData({
      subscription: {
        id: 'sub_1',
        status: 'past_due',
        currentPeriodStart: '2026-01-01T00:00:00Z',
        currentPeriodEnd: '2026-02-01T00:00:00Z',
        cancelAtPeriodEnd: false,
      },
      hasAccess: false,
    });

    render(
      <MemoryRouter>
        <SubscriptionBanner />
      </MemoryRouter>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });
});
