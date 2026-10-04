import type { PaymentStatus, Prisma } from '@prisma/client';

export interface PaymentDbRecord {
  id: string;
  amount: Prisma.Decimal | number | string | unknown;
  currency: string;
  status: PaymentStatus | string;
  paidAt: Date | string | null;
  createdAt: Date | string;
  [key: string]: unknown;
}

export interface SerializedPayment {
  id: string;
  amount: string;
  currency: string;
  status: PaymentStatus | string;
  paidAt: Date | string | null;
  createdAt: Date | string;
}

export type SerializePaymentInput = PaymentDbRecord;

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
