import type { PaymentStatus, Prisma } from '@prisma/client';

export type SerializedPayment = {
  id: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
};

export type SerializePaymentInput = {
  id: string;
  amount: Prisma.Decimal | number | string;
  currency: string;
  status: PaymentStatus;
  paidAt: Date | null;
  createdAt: Date;
};

export const serializePayment = (
  payment: SerializePaymentInput,
): SerializedPayment => ({
  id: payment.id,
  amount: payment.amount.toString(),
  currency: payment.currency,
  status: payment.status,
  paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
  createdAt: payment.createdAt.toISOString(),
});
