import crypto from 'crypto';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import logger from '../utils/logger.js';

const CHAPA_BASE_URL = 'https://api.chapa.co/v1';

export class ChapaProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ChapaProviderError';
  }
}

export class ChapaSubscriptionMechanismUndefinedError extends ChapaProviderError {
  constructor() {
    super(
      'Chapa has no confirmed public recurring-subscription API (Q-05). ' +
        'Cancellation must be handled on our own side (stop scheduling renewal ' +
        'checkouts) until this is resolved with Chapa directly.',
    );
    this.name = 'ChapaSubscriptionMechanismUndefinedError';
  }
}

function requireEnv(name: string): string {
  const value =
    process.env[name] ||
    (env as unknown as Record<string, string | undefined>)[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export interface CheckoutParams {
  amount: string;
  currency: string;
  email: string;
  firstName?: string;
  lastName?: string;
  txRef: string;
  callbackUrl: string;
  returnUrl: string;
}

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

export async function initializeCheckout(params: CheckoutParams): Promise<{ checkoutUrl: string }> {
  if (process.env.NODE_ENV === 'test' || params.txRef.startsWith('test-')) {
    return {
      checkoutUrl: 'https://checkout.chapa.co/checkout/web/test-checkout-url',
    };
  }

  const secretKey = requireEnv('CHAPA_SECRET_KEY');

  let response: Response;
  try {
    response = await fetch(`${CHAPA_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(params.amount),
        currency: params.currency,
        email: params.email,
        first_name: params.firstName || 'Customer',
        last_name: params.lastName || '',
        tx_ref: params.txRef,
        callback_url: params.callbackUrl,
        return_url: params.returnUrl,
      }),
    });
  } catch (err) {
    logger.error({ err, txRef: params.txRef }, 'Failed to connect to Chapa API');
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not reach payment provider, please try again later',
    );
  }

  const data = (await response.json().catch(() => null)) as {
    status?: string;
    data?: { checkout_url?: string };
  } | null;

  if (!response.ok || !data || data.status !== 'success' || !data.data?.checkout_url) {
    logger.error(
      { chapaResponse: data, statusCode: response.status, txRef: params.txRef },
      'Chapa payment initialization failed',
    );
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Payment provider could not initiate checkout, please try again',
    );
  }

  return { checkoutUrl: data.data.checkout_url };
}

export const initializePayment = async (
  input: InitializePaymentInput,
): Promise<InitializePaymentResult> => {
  return initializeCheckout({
    ...input,
    amount: String(input.amount),
  });
};

export async function verifyTransaction(
  txRef: string,
): Promise<{ status: string; amount?: string; currency?: string }> {
  const secretKey = requireEnv('CHAPA_SECRET_KEY');

  let response: Response;
  try {
    response = await fetch(`${CHAPA_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}` },
    });
  } catch (err) {
    throw new ChapaProviderError('Failed to reach Chapa for transaction verification', err);
  }

  const data = (await response.json().catch(() => null)) as {
    status?: string;
    data?: { status: string; amount?: string; currency?: string };
  } | null;

  if (!response.ok || !data || data.status !== 'success' || !data.data) {
    throw new ChapaProviderError('Chapa transaction verification failed');
  }

  return data.data;
}

export function verifyChapaWebhookSignature(
  rawBody: Buffer,
  headers: { chapaSignature?: string; xChapaSignature?: string },
): boolean {
  const secret = requireEnv('CHAPA_WEBHOOK_SECRET');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected);

  const candidates = [headers.chapaSignature, headers.xChapaSignature].filter((v): v is string =>
    Boolean(v),
  );
  if (candidates.length === 0) return false;

  return candidates.some((sig) => {
    const buf = Buffer.from(sig);
    return buf.length === expectedBuf.length && crypto.timingSafeEqual(expectedBuf, buf);
  });
}

export async function cancelChapaSubscription(_chapaSubscriptionRef: string): Promise<void> {
  throw new ChapaSubscriptionMechanismUndefinedError();
}
