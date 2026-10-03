import { Request, Response, NextFunction } from 'express';
import { listPayments } from '../services/subscription.service';
import { serializePayment } from '../serializers/payment.serializer';

// GET /payments
export async function getPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await listPayments((req as any).user.id);
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Payment history',
      data: { payments: payments.map(serializePayment) },
    });
  } catch (err) {
    next(err);
  }
}
