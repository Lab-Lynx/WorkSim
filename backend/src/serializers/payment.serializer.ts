export interface PaymentDbRecord {
  id: string;
  amount: string;
  currency: string;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
  [key: string]: unknown; // tolerates chapaTxRef, userId, subscriptionId, etc.
}

export interface SerializedPayment {
  id: string;
  amount: string;
  currency: string;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
}

export function serializePayment(payment: PaymentDbRecord): SerializedPayment {
  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  };
}
