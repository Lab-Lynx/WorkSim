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

// Deliberately distinct from ChapaProviderError: this isn't "Chapa failed,"
// it's "we don't know what to call yet." Q-05 is unresolved — no public
// Chapa recurring-charge/cancel API was found as of writing this adapter.
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
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

interface CheckoutParams {
  amount: string;
  currency: string;
  email: string;
  firstName?: string;
  lastName?: string;
  txRef: string;
  callbackUrl: string;
  returnUrl: string;
}

export async function initializeCheckout(params: CheckoutParams): Promise<{ checkoutUrl: string }> {
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
        amount: params.amount,
        currency: params.currency,
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
        tx_ref: params.txRef,
        callback_url: params.callbackUrl,
        return_url: params.returnUrl,
      }),
    });
  } catch (err) {
    throw new ChapaProviderError('Failed to reach Chapa for checkout initialization', err);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.status !== 'success' || !data.data?.checkout_url) {
    // Deliberately generic — never echo raw Chapa response text, which
    // could theoretically include request details, into the thrown error.
    throw new ChapaProviderError('Chapa checkout initialization failed');
  }

  return { checkoutUrl: data.data.checkout_url };
}

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

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.status !== 'success') {
    throw new ChapaProviderError('Chapa transaction verification failed');
  }

  return data.data;
}

export function verifyChapaWebhookSignature(
  rawBody: Buffer,
  headers: { chapaSignature?: string; xChapaSignature?: string },
): boolean {
  const secret = requireEnv('CHAPA_WEBHOOK_SECRET');
  const crypto = require('crypto');
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

// --- Renewal & cancellation: isolated per Q-05, see ChapaSubscriptionMechanismUndefinedError above ---

export async function initiateRenewalCheckout(
  params: CheckoutParams,
): Promise<{ checkoutUrl: string }> {
  // No confirmed Chapa auto-renewal API exists. Until Q-05 is resolved,
  // a "renewal" is a fresh checkout using the one real endpoint that exists.
  // Kept as its own named function (rather than callers using
  // initializeCheckout directly for renewals) so that IF Chapa later
  // exposes a real recurring-charge endpoint, only this function's body
  // changes — every caller stays the same.
  return initializeCheckout(params);
}

export async function cancelChapaSubscription(_chapaSubscriptionRef: string): Promise<void> {
  throw new ChapaSubscriptionMechanismUndefinedError();
}

export async function chargeRenewal(params: {
  subscriptionId: string;
  txRef: string;
}): Promise<void> {
  // No confirmed Chapa mechanism exists to charge a customer with zero
  // interaction (see callout above) — Direct Charge still requires the
  // customer to actively authorize. This throws honestly rather than
  // faking success.
  throw new ChapaSubscriptionMechanismUndefinedError();
}