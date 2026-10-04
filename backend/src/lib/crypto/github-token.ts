import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';
import { HTTP_STATUS } from '../../constants/index.js';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_LENGTH = 12;

const getKey = (): Buffer =>
  createHash('sha256').update(env.GITHUB_TOKEN_ENCRYPTION_KEY, 'utf8').digest();

const decodeBase64Url = (value: string): Buffer => {
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Invalid encrypted GitHub access token');
  }
  return decoded;
};

export const encryptGitHubToken = (token: string): string => {
  if (!token) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'GitHub access token must not be empty');
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
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Invalid encrypted GitHub access token');
  }

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      getKey(),
      decodeBase64Url(encodedIv),
    );
    decipher.setAuthTag(decodeBase64Url(encodedAuthTag));
    return Buffer.concat([
      decipher.update(decodeBase64Url(encodedCiphertext)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Invalid encrypted GitHub access token');
  }
};
