import React, { useEffect, useState } from 'react';
import { usePayments } from '@/hooks/billing/usePayments';
import { formatAmount, formatDate } from '@/lib/format';
import StatusBadge from '@/components/common/StatusBadge';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import type { Payment } from '@/types/api';

export default function PaymentHistory(): React.JSX.Element {
    const { data: payments, isLoading, error, refetch } = usePayments();
    const [isDesktop, setIsDesktop] = useState<boolean>(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
        return window.matchMedia('(min-width: 768px)').matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mediaQuery = window.matchMedia('(min-width: 768px)');
        const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        }
    }, []);

    if (isLoading) {
        return (
            <div role="status" aria-label="Loading payment history" className="p-4 text-center text-sm text-text-muted">
                Loading payments…
            </div>
        );
    }

    if (error) {
        return (
            <ErrorState
                message="Failed to load payment history"
                onRetry={() => void refetch()}
            />
        );
    }

    if (!payments || payments.length === 0) {
        return (
            <EmptyState
                title="No payments"
                description="No payment history found."
            />
        );
    }

    return (
        <section aria-label="Payment History" className="w-full">
            {/* Table Rendering (Desktop) */}
            <div
                className="hidden md:block overflow-x-auto"
                aria-hidden={!isDesktop}
            >
                <table className="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-border text-text-muted font-medium">
                            <th scope="col" className="py-3 px-4">Date</th>
                            <th scope="col" className="py-3 px-4">Amount</th>
                            <th scope="col" className="py-3 px-4">Status</th>
                            <th scope="col" className="py-3 px-4">Payment ID</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {payments.map((payment: Payment) => (
                            <tr key={payment.id} className="hover:bg-surface-elevated/50 transition-colors">
                                <td className="py-3 px-4 text-text-body">{formatDate(payment.createdAt)}</td>
                                <td className="py-3 px-4 font-medium text-foreground">
                                    {formatAmount(payment.amount, payment.currency)}
                                </td>
                                <td className="py-3 px-4">
                                    <StatusBadge domain="payment" status={payment.status} />
                                </td>
                                <td className="py-3 px-4 font-mono text-xs text-text-muted">{payment.id}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Card Rendering (Mobile) */}
            <div
                className="block md:hidden flex flex-col gap-3"
                aria-hidden={isDesktop}
            >
                {payments.map((payment: Payment) => (
                    <div
                        key={payment.id}
                        className="p-4 rounded-lg border border-border bg-surface flex flex-col gap-2"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-text-muted">{formatDate(payment.createdAt)}</span>
                            <StatusBadge domain="payment" status={payment.status} />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-base font-semibold text-foreground">
                                {formatAmount(payment.amount, payment.currency)}
                            </span>
                            <span className="font-mono text-xs text-text-muted">{payment.id}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}