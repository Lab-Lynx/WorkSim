import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentHistory from '@/components/billing/PaymentHistory';
import type { Payment } from '@/types/api';

vi.mock('@/hooks/billing/usePayments');

import { usePayments } from '@/hooks/billing/usePayments';

const mockPayments: Payment[] = [
    {
        id: 'pay_101',
        amount: '100.00',
        currency: 'ETB',
        status: 'completed',
        createdAt: '2026-03-01T10:00:00Z',
    },
    {
        id: 'pay_102',
        amount: '100.00',
        currency: 'ETB',
        status: 'failed',
        createdAt: '2026-02-01T10:00:00Z',
    },
];

describe('PaymentHistory Component', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: query.includes('min-width: 768px'),
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    it('renders loading state correctly', () => {
        vi.mocked(usePayments).mockReturnValue({
            data: undefined,
            isLoading: true,
            error: null,
        } as unknown as ReturnType<typeof usePayments>);

        render(<PaymentHistory />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders error state when hook fails', () => {
        vi.mocked(usePayments).mockReturnValue({
            data: undefined,
            isLoading: false,
            error: new Error('Failed to load payments'),
        } as unknown as ReturnType<typeof usePayments>);

        render(<PaymentHistory />);
        expect(screen.getByText('Failed to load payment history')).toBeInTheDocument();
    });

    it('renders empty state when payment list is empty', () => {
        vi.mocked(usePayments).mockReturnValue({
            data: [],
            isLoading: false,
            error: null,
        } as unknown as ReturnType<typeof usePayments>);

        render(<PaymentHistory />);
        expect(screen.getByText('No payment history found.')).toBeInTheDocument();
    });

    it('renders both table and card views with the same payment data', () => {
        vi.mocked(usePayments).mockReturnValue({
            data: mockPayments,
            isLoading: false,
            error: null,
        } as unknown as ReturnType<typeof usePayments>);

        render(<PaymentHistory />);

        const amounts = screen.getAllByText('100.00 ETB');
        expect(amounts.length).toBeGreaterThanOrEqual(2);

        const completedBadges = screen.getAllByText('completed');
        expect(completedBadges.length).toBeGreaterThanOrEqual(2);
    });

    it('ensures only one rendering is visible at a time to screen readers', () => {
        vi.mocked(usePayments).mockReturnValue({
            data: mockPayments,
            isLoading: false,
            error: null,
        } as unknown as ReturnType<typeof usePayments>);

        const { container } = render(<PaymentHistory />);

        const tableWrapper = container.querySelector('.hidden.md\\:block');
        const cardWrapper = container.querySelector('.block.md\\:hidden');

        expect(tableWrapper).toBeInTheDocument();
        expect(cardWrapper).toBeInTheDocument();

        expect(tableWrapper).toHaveAttribute('aria-hidden', 'false');
        expect(cardWrapper).toHaveAttribute('aria-hidden', 'true');
    });
});