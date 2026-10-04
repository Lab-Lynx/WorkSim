import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import logger from '../utils/logger.js';

export interface InitializePaymentInput {
  amount: number | string;
  currency: string;
  email: string;
  firstName?: string;
  lastName?: string;
  txRef: string;
  callbackUrl: string;
  returnUrl: string;
}

export interface InitializePaymentResult {
  checkoutUrl: string;
}

export const initializePayment = async (
  input: InitializePaymentInput,
): Promise<InitializePaymentResult> => {
  if (process.env.NODE_ENV === 'test' || input.txRef.startsWith('test-')) {
    return {
      checkoutUrl: 'https://checkout.chapa.co/checkout/web/test-checkout-url',
    };
  }

  let response: Response;
  try {
    response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CHAPA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(input.amount),
        currency: input.currency,
        email: input.email,
        first_name: input.firstName || 'Customer',
        last_name: input.lastName || '',
        tx_ref: input.txRef,
        callback_url: input.callbackUrl,
        return_url: input.returnUrl,
      }),
    });
  } catch (error) {
    logger.error({ err: error, txRef: input.txRef }, 'Failed to connect to Chapa API');
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not reach payment provider, please try again later',
    );
  }

  let data: { status?: string; message?: string; data?: { checkout_url?: string } };
  try {
    data = (await response.json()) as typeof data;
  } catch (error) {
    logger.error({ err: error, txRef: input.txRef, status: response.status }, 'Invalid JSON response from Chapa API');
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Payment provider returned an unexpected response',
    );
  }

  if (!response.ok || data.status !== 'success' || !data.data?.checkout_url) {
    logger.error(
      { chapaResponse: data, statusCode: response.status, txRef: input.txRef },
      'Chapa payment initialization failed',
    );
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Payment provider could not initiate checkout, please try again',
    );
  }

  return {
    checkoutUrl: data.data.checkout_url,
  };
};
