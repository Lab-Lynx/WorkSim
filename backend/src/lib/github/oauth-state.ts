import crypto from 'crypto';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — plenty for a user to click "Authorize" on GitHub

export class OAuthStateError extends Error {
  readonly code = 'state_invalid' as const;
  constructor(message: string) {
    super(message);
    this.name = 'OAuthStateError';
  }
}

function getStateSecret(): string {
  const secret = process.env.GITHUB_OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error('GITHUB_OAUTH_STATE_SECRET is not set');
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return crypto.createHmac('sha256', getStateSecret()).update(encodedPayload).digest('hex');
}

export function createOAuthState(userId: string): string {
  const payload = JSON.stringify({
    userId,
    expiresAt: Date.now() + STATE_TTL_MS,
  });
  const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthState(state: string, expectedUserId: string): void {
  const parts = state.split('.');
  if (parts.length !== 2) {
    throw new OAuthStateError('Malformed state');
  }
  const [encodedPayload, signature] = parts;

  if (!signaturesMatch(sign(encodedPayload), signature)) {
    throw new OAuthStateError('Invalid state signature');
  }

  let payload: { userId: string; expiresAt: number };
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new OAuthStateError('Malformed state payload');
  }

  if (typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) {
    throw new OAuthStateError('State has expired');
  }

  if (payload.userId !== expectedUserId) {
    throw new OAuthStateError('State does not belong to the current user');
  }
}

function signaturesMatch(expected: string, actual: string): boolean {
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(actual, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
