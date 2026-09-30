import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentHistory from '@/components/billing/PaymentHistory';
import type { Payment } from '@/types';

const mockPayments: Payment[] = [
    {
        id: 'pay_101',
        amount: '100.00',
        currency: 'ETB',
        status: 'succeeded',
        createdAt: '2026-03-01T10:00:00Z',
        paidAt: '2026-03-01T10:00:00Z',
    },
    {
        id: 'pay_102',
        amount: '100.00',
        currency: 'ETB',
        status: 'failed',
        createdAt: '2026-02-01T10:00:00Z',
        paidAt: null,
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

    it('renders the empty state when there are no payments', () => {
        render(<PaymentHistory payments={[]} />);
        expect(screen.getByRole('heading', { name: 'No payments yet.' })).toBeInTheDocument();
    });

    it('renders table and cards from the supplied data without sorting', () => {
        render(<PaymentHistory payments={mockPayments} />);

        expect(screen.getAllByText('100.00 ETB')).toHaveLength(4);
        expect(screen.getAllByText('Succeeded')).toHaveLength(2);
    });

    it('uses paidAt when available and createdAt otherwise', () => {
        render(<PaymentHistory payments={mockPayments} />);

        expect(screen.getAllByText('1 Mar 2026')).toHaveLength(2);
        expect(screen.getAllByText('1 Feb 2026')).toHaveLength(2);
    });

    it('exposes only the visible responsive rendering to screen readers', () => {
        const { container } = render(<PaymentHistory payments={mockPayments} />);

        const tableWrapper = container.querySelector('.hidden.md\\:block');
        const cardWrapper = container.querySelector('.block.md\\:hidden');

        expect(tableWrapper).toHaveAttribute('aria-hidden', 'false');
        expect(cardWrapper).toHaveAttribute('aria-hidden', 'true');
    });
});