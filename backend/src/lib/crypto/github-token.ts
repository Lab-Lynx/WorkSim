import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_LENGTH = 12;

const getKey = (): Buffer =>
  createHash('sha256').update(env.GITHUB_TOKEN_ENCRYPTION_KEY, 'utf8').digest();

export const encryptGitHubToken = (token: string): string => {
  if (!token) {
    throw new Error('GitHub access token must not be empty');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
};

export const decryptGitHubToken = (encryptedToken: string): string => {
  const [version, encodedIv, encodedAuthTag, encodedCiphertext] = encryptedToken.split('.');
  if (
    version !== VERSION ||
    !encodedIv ||
    !encodedAuthTag ||
    !encodedCiphertext
  ) {
    throw new Error('Invalid encrypted GitHub access token');
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(encodedIv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(encodedAuthTag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Invalid encrypted GitHub access token');
  }
};
