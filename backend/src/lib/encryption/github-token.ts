import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits — the recommended IV size for GCM
const KEY_LENGTH = 32; // 256 bits — required for AES-256

function getEncryptionKey(): Buffer {
  const keyHex = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY is not set');
  }

  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `GITHUB_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length})`,
    );
  }
  return key;
}

export function encryptGitHubToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Store iv, authTag, and ciphertext together — you need all three to
  // decrypt later, and none of them are secret on their own.
  return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
}

export function decryptGitHubToken(encryptedValue: string): string {
  const key = getEncryptionKey();

  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;

  let iv: Buffer, authTag: Buffer, ciphertext: Buffer;
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
    // GCM's built-in integrity check fails here for either a wrong key
    // or tampered/corrupted ciphertext — we don't need to (and can't
    // cleanly) tell those two cases apart, so one clear error covers both.
    throw new Error('Failed to decrypt GitHub token: invalid key or corrupted data');
  }
}
