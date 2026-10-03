export interface PaymentDbRecord {
  id: string;
  amount: unknown;
  currency: string;
  status: string;
  paidAt: Date | string | null;
  createdAt: Date | string;
  [key: string]: unknown;
}

export interface SerializedPayment {
  id: string;
  amount: string;
  currency: string;
  status: string;
  paidAt: Date | string | null;
  createdAt: Date | string;
}

export function serializePayment(payment: PaymentDbRecord): SerializedPayment {
  return {
    id: payment.id,
    amount:
      typeof payment.amount === 'object' && payment.amount !== null && 'toString' in payment.amount
        ? (payment.amount as { toString(): string }).toString()
        : String(payment.amount ?? '0.00'),
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  };
}
