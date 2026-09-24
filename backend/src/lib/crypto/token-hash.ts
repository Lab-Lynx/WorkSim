import { createHash, timingSafeEqual } from 'node:crypto';

const SHA256_HEX_LENGTH = 64;

export const hashToken = (rawToken: string): string =>
  createHash('sha256').update(rawToken).digest('hex');

export const compareToken = (rawToken: string, storedHash: string): boolean => {
  const candidateHash = hashToken(rawToken);

  if (storedHash.length !== SHA256_HEX_LENGTH) {
    return false;
  }

  return timingSafeEqual(Buffer.from(candidateHash, 'utf8'), Buffer.from(storedHash, 'utf8'));
};
