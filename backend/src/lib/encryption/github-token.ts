import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits
const KEY_LENGTH = 32; // 256 bits

function getEncryptionKey(): Buffer {
  const keyStr = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!keyStr) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY is not set');
  }

  if (/^[0-9a-fA-F]{64}$/.test(keyStr)) {
    return Buffer.from(keyStr, 'hex');
  }
  if (Buffer.byteLength(keyStr, 'utf8') === KEY_LENGTH) {
    return Buffer.from(keyStr, 'utf8');
  }
  return crypto.createHash('sha256').update(keyStr).digest();
}

export function encryptGitHubToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
}

export function decryptGitHubToken(encryptedValue: string): string {
  const key = getEncryptionKey();

  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;

  let iv: Buffer;
  let authTag: Buffer;
  let ciphertext: Buffer;
  try {
    iv = Buffer.from(ivHex, 'hex');
    authTag = Buffer.from(authTagHex, 'hex');
    ciphertext = Buffer.from(ciphertextHex, 'hex');
  } catch {
    throw new Error('Invalid encrypted token format');
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Failed to decrypt GitHub token: invalid key or corrupted data');
  }
}
