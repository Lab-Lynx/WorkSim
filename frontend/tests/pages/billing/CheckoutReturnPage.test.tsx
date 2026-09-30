import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CheckoutReturnPage } from '@/pages/billing/CheckoutReturnPage';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { ROUTES } from '@/constants';

vi.mock('@/hooks/billing/useSubscription', () => ({
    useSubscription: vi.fn(),
}));

const mockedUseSubscription = vi.mocked(useSubscription);
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

function renderComponent(initialEntry = '/checkout/return?session_id=cs_test_123') {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path="/checkout/return" element={<CheckoutReturnPage />} />
                <Route path="/github" element={<div>GitHub setup</div>} />
            </Routes>
        </MemoryRouter>
    );
}

describe('CheckoutReturnPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('ignores provider query parameters and continues confirming when no active access exists', () => {
        mockedUseSubscription.mockReturnValue({
            data: {
                hasAccess: true,
                subscription: { status: 'canceled' },
            },
            isLoading: false,
            isError: false,
        } as unknown as ReturnType<typeof useSubscription>);

        renderComponent('/checkout/return?provider_state=returned&session_id=ignored');

        expect(screen.getByText('Verifying Your Payment')).toBeInTheDocument();
        expect(screen.queryByText('Subscription Confirmed!')).not.toBeInTheDocument();
    });

    it('renders loading state while polling subscription status', () => {
        mockedUseSubscription.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
        } as ReturnType<typeof useSubscription>);

        renderComponent();

        expect(screen.getByText('Verifying Your Payment')).toBeInTheDocument();
        expect(
            screen.getByText('Please wait while we confirm your subscription details...')
        ).toBeInTheDocument();
    });

    it('renders success state when subscription access is confirmed', () => {
        mockedUseSubscription.mockReturnValue({
            data: {
                hasAccess: true,
                subscription: { status: 'active' },
            },
            isLoading: false,
            isError: false,
        } as unknown as ReturnType<typeof useSubscription>);

        renderComponent();

        expect(screen.getByText('Subscription Confirmed')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /connect github/i })).toHaveAttribute(
            'href',
            '/github'
        );
    });

    it('navigates to dashboard when clicking button on success state', () => {
        mockedUseSubscription.mockReturnValue({
            data: {
                hasAccess: true,
                subscription: { status: 'active' },
            },
            isLoading: false,
            isError: false,
        } as unknown as ReturnType<typeof useSubscription>);

        renderComponent();

        const button = screen.getByRole('button', { name: /Go to Dashboard/i });
        fireEvent.click(button);

        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.DASHBOARD);
    });

    it('renders error state if subscription request fails', () => {
        mockedUseSubscription.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
        } as ReturnType<typeof useSubscription>);

        renderComponent();

        expect(screen.getByText('Unable to Verify Subscription')).toBeInTheDocument();
    });

    it('handles polling timeout after 60 seconds', () => {
        mockedUseSubscription.mockReturnValue({
            data: { hasAccess: false },
            isLoading: false,
            isError: false,
        } as unknown as ReturnType<typeof useSubscription>);

        renderComponent();

        act(() => {
            vi.advanceTimersByTime(61_000);
        });

        expect(
            screen.getByText('Verification Taking Longer Than Expected')
        ).toBeInTheDocument();
    });
});