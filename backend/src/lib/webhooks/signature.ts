import crypto from 'node:crypto';

const normalizeSignature = (value: string, prefix: string): string | null => {
  const normalized = value.trim();
  if (!normalized.startsWith(prefix)) return null;
  const hex = normalized.slice(prefix.length);
  return /^[a-f0-9]{64}$/i.test(hex) ? hex : null;
};

const verifyHmac = (rawBody: Buffer, supplied: string | undefined, secret: string, prefix: string) => {
  if (!supplied) return false;
  const actual = normalizeSignature(supplied, prefix);
  if (!actual) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
};

export const verifyChapaSignature = (rawBody: Buffer, supplied: string | undefined, secret: string) =>
  verifyHmac(rawBody, supplied, secret, '');

export const verifyGitHubSignature = (rawBody: Buffer, supplied: string | undefined, secret: string) =>
  verifyHmac(rawBody, supplied, secret, 'sha256=');
