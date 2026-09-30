import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import ApiError from '../../src/utils/ApiError.js';
import { HTTP_STATUS } from '../../src/constants/index.js';
import { hashToken } from '../../src/lib/crypto/token-hash.js';

// Mocks
const userFindUnique = vi.fn();
const userCreate = vi.fn();
const userUpdate = vi.fn();

const emailTokenFindUnique = vi.fn();
const emailTokenCreate = vi.fn();
const emailTokenUpdate = vi.fn();

const passwordResetTokenFindUnique = vi.fn();
const passwordResetTokenCreate = vi.fn();
const passwordResetTokenUpdate = vi.fn();

const refreshTokenFindUnique = vi.fn();
const refreshTokenCreate = vi.fn();
const refreshTokenUpdate = vi.fn();
const refreshTokenUpdateMany = vi.fn();
const refreshTokenDelete = vi.fn();
const refreshTokenDeleteMany = vi.fn();

const transaction = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    user: {
      findUnique: userFindUnique,
      create: userCreate,
      update: userUpdate,
    },
    emailVerificationToken: {
      findUnique: emailTokenFindUnique,
      create: emailTokenCreate,
      update: emailTokenUpdate,
    },
    passwordResetToken: {
      findUnique: passwordResetTokenFindUnique,
      create: passwordResetTokenCreate,
      update: passwordResetTokenUpdate,
    },
    refreshToken: {
      findUnique: refreshTokenFindUnique,
      create: refreshTokenCreate,
      update: refreshTokenUpdate,
      updateMany: refreshTokenUpdateMany,
      delete: refreshTokenDelete,
      deleteMany: refreshTokenDeleteMany,
    },
    $transaction: transaction,
  },
}));

const sendVerificationEmail = vi.fn();
const sendPasswordResetEmail = vi.fn();

vi.mock('../../src/services/email.service.js', () => ({
  sendVerificationEmail,
  sendPasswordResetEmail,
}));

const loggerInfo = vi.fn();
const loggerError = vi.fn();
const loggerWarn = vi.fn();
const loggerDebug = vi.fn();

vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: loggerInfo,
    error: loggerError,
    warn: loggerWarn,
    debug: loggerDebug,
  },
}));

const {
  registerUser,
  authenticateUser,
  revokeAllSessions,
  verifyEmail,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
} = await import('../../src/services/auth.service.js');

const { env } = await import('../../src/config/env.js');

const baseUserRow = {
  id: 'user-123',
  name: 'Abel',
  email: 'a@x.com',
  passwordHash: '$2b$10$hashedpasswordstringsample',
  role: 'user',
  emailVerifiedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const allLoggerCalls = () => [
  ...loggerInfo.mock.calls,
  ...loggerError.mock.calls,
  ...loggerWarn.mock.calls,
  ...loggerDebug.mock.calls,
];

describe('auth.service (doc 9 §9.2.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default $transaction behavior: if given callback, run it with tx; if given array, resolve it.
    transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        const tx = {
          user: { create: userCreate, update: userUpdate, findUnique: userFindUnique },
          emailVerificationToken: { create: emailTokenCreate, update: emailTokenUpdate },
          passwordResetToken: { create: passwordResetTokenCreate, update: passwordResetTokenUpdate },
          refreshToken: { updateMany: refreshTokenUpdateMany },
        };
        return arg(tx);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    });
  });

  describe('registerUser', () => {
    it('registerUser — registers a new user', async () => {
      userFindUnique.mockResolvedValue(null);
      const hashSpy = vi.spyOn(bcrypt, 'hash').mockResolvedValue('hash123' as never);

      userCreate.mockResolvedValue({
        id: 'user-123',
        name: 'Abel',
        email: 'a@x.com',
        role: 'user',
        emailVerifiedAt: null,
        createdAt: baseUserRow.createdAt,
      });
      emailTokenCreate.mockResolvedValue({ id: 'token-1' });

      const result = await registerUser('Abel', 'a@x.com', 'password1');

      expect(userCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Abel',
            email: 'a@x.com',
            passwordHash: 'hash123',
          },
        }),
      );
      expect(result.user).toEqual({
        id: 'user-123',
        name: 'Abel',
        email: 'a@x.com',
        role: 'user',
        emailVerifiedAt: null,
        createdAt: baseUserRow.createdAt,
      });
      expect(result).toHaveProperty('verificationToken');
      expect(typeof result.verificationToken).toBe('string');

      // No create argument contains plaintext password
      const createCallStr = JSON.stringify(userCreate.mock.calls);
      expect(createCallStr).not.toContain('password1');

      hashSpy.mockRestore();
    });

    it('registerUser — email normalization matches login', async () => {
      userFindUnique.mockResolvedValue(null);
      userCreate.mockResolvedValue({
        id: 'user-123',
        name: 'Abel',
        email: 'a@x.com',
        role: 'user',
        emailVerifiedAt: null,
        createdAt: baseUserRow.createdAt,
      });

      await registerUser('Abel', ' A@X.com ', 'password1');
      const registeredEmail = userCreate.mock.calls[0][0].data.email;

      // Mock user lookup for authenticateUser
      userFindUnique.mockResolvedValue({
        ...baseUserRow,
        email: registeredEmail,
      });
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await authenticateUser(' A@X.com ', 'password1');
      const lookupEmail = userFindUnique.mock.calls[userFindUnique.mock.calls.length - 1][0].where.email;

      expect(registeredEmail).toBe(lookupEmail);
      expect(registeredEmail).toBe('a@x.com');

      compareSpy.mockRestore();
    });

    it('registerUser — duplicate email throws 409', async () => {
      userFindUnique.mockResolvedValue(baseUserRow);

      await expect(registerUser('Abel', 'a@x.com', 'password1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'Email already in use',
      });
      await expect(registerUser('Abel', 'a@x.com', 'password1')).rejects.toBeInstanceOf(ApiError);
    });

    it('registerUser — concurrent duplicate (P2002 on create) throws 409', async () => {
      userFindUnique.mockResolvedValue(null);
      userCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(registerUser('Abel', 'a@x.com', 'password1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'Email already in use',
      });
    });

    it('registerUser — other DB errors are not masked', async () => {
      userFindUnique.mockResolvedValue(null);
      const dbErr = new Error('Database connection failed');
      userCreate.mockRejectedValue(dbErr);

      await expect(registerUser('Abel', 'a@x.com', 'password1')).rejects.toThrow('Database connection failed');
    });

    it('registerUser — password never logged', async () => {
      userFindUnique.mockResolvedValue(null);
      userCreate.mockResolvedValue({
        ...baseUserRow,
      });

      await registerUser('Abel', 'a@x.com', 'sensitive_password_123');

      const logs = JSON.stringify(allLoggerCalls());
      expect(logs).not.toContain('sensitive_password_123');
    });
  });

  describe('authenticateUser', () => {
    it('authenticateUser — valid credentials returns user', async () => {
      userFindUnique.mockResolvedValue(baseUserRow);
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const user = await authenticateUser('a@x.com', 'password1');

      expect(user).toEqual({
        id: 'user-123',
        name: 'Abel',
        email: 'a@x.com',
        role: 'user',
        emailVerifiedAt: null,
        createdAt: baseUserRow.createdAt,
      });
      expect(user).not.toHaveProperty('passwordHash');

      compareSpy.mockRestore();
    });

    it('authenticateUser — unknown email throws 401', async () => {
      userFindUnique.mockResolvedValue(null);

      await expect(authenticateUser('unknown@x.com', 'password1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        message: 'Invalid email or password',
      });
    });

    it('authenticateUser — wrong password throws 401 with identical message', async () => {
      userFindUnique.mockResolvedValue(baseUserRow);
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(authenticateUser('a@x.com', 'wrongpassword')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        message: 'Invalid email or password',
      });

      compareSpy.mockRestore();
    });

    it('authenticateUser — malformed stored hash throws 401, not 500', async () => {
      userFindUnique.mockResolvedValue({
        ...baseUserRow,
        passwordHash: 'not-a-valid-bcrypt-hash',
      });
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockRejectedValue(new Error('Invalid hash') as never);

      await expect(authenticateUser('a@x.com', 'password1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        message: 'Invalid email or password',
      });

      compareSpy.mockRestore();
    });

    it('authenticateUser — unverified user can log in (Q-04)', async () => {
      userFindUnique.mockResolvedValue({
        ...baseUserRow,
        emailVerifiedAt: null,
      });
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const user = await authenticateUser('a@x.com', 'password1');
      expect(user.id).toBe('user-123');
      expect(user.emailVerifiedAt).toBeNull();

      compareSpy.mockRestore();
    });

    it('authenticateUser — hash never logged', async () => {
      userFindUnique.mockResolvedValue(baseUserRow);
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await authenticateUser('a@x.com', 'password1');

      const logs = JSON.stringify(allLoggerCalls());
      expect(logs).not.toContain('$2b$10$hashedpasswordstringsample');

      compareSpy.mockRestore();
    });
  });

  describe('revokeAllSessions', () => {
    it('revokeAllSessions — revokes all active sessions with revokedAt: null', async () => {
      refreshTokenUpdateMany.mockResolvedValue({ count: 3 });

      await revokeAllSessions('user-123');

      expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('revokeAllSessions — resolves with no error when no active sessions', async () => {
      refreshTokenUpdateMany.mockResolvedValue({ count: 0 });

      await expect(revokeAllSessions('user-123')).resolves.toBeUndefined();
    });

    it('revokeAllSessions — history preserved (no delete/deleteMany calls)', async () => {
      refreshTokenUpdateMany.mockResolvedValue({ count: 1 });

      await revokeAllSessions('user-123');

      expect(refreshTokenDelete).not.toHaveBeenCalled();
      expect(refreshTokenDeleteMany).not.toHaveBeenCalled();
    });

    it('revokeAllSessions — other users untouched (where clause contains userId)', async () => {
      refreshTokenUpdateMany.mockResolvedValue({ count: 1 });

      await revokeAllSessions('user-456');

      expect(refreshTokenUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-456' }),
        }),
      );
    });
  });

  describe('verifyEmail', () => {
    const rawToken = 'raw-verify-token-123';
    const hashed = hashToken(rawToken);

    it('verifyEmail — valid token consumes token and updates user in one transaction', async () => {
      emailTokenFindUnique.mockResolvedValue({
        id: 'token-row-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        user: { id: 'user-123', emailVerifiedAt: null },
      });

      emailTokenUpdate.mockResolvedValue({ id: 'token-row-1' });
      userUpdate.mockResolvedValue({ id: 'user-123' });

      const result = await verifyEmail(rawToken);

      expect(emailTokenFindUnique).toHaveBeenCalledWith({
        where: { tokenHash: hashed },
        include: { user: { select: { id: true, emailVerifiedAt: true } } },
      });

      expect(transaction).toHaveBeenCalled();
      expect(emailTokenUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'token-row-1' },
          data: { usedAt: expect.any(Date) },
        }),
      );
      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: { emailVerifiedAt: expect.any(Date) },
        }),
      );

      expect(result.alreadyVerified).toBe(false);
      expect(result.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('verifyEmail — unknown token throws 400', async () => {
      emailTokenFindUnique.mockResolvedValue(null);

      await expect(verifyEmail('unknown-raw-token')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Invalid verification link',
      });
      await expect(verifyEmail('unknown-raw-token')).rejects.toBeInstanceOf(ApiError);
    });

    it('verifyEmail — expired unused token throws 410 and does not update user', async () => {
      emailTokenFindUnique.mockResolvedValue({
        id: 'token-row-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() - 3600000), // in the past
        usedAt: null,
        user: { id: 'user-123', emailVerifiedAt: null },
      });

      await expect(verifyEmail(rawToken)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.GONE,
        message: 'This verification link has expired',
      });
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('verifyEmail — already used token returns soft 200 already verified (D-11)', async () => {
      const pastDate = new Date('2026-01-15T00:00:00.000Z');
      emailTokenFindUnique.mockResolvedValue({
        id: 'token-row-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() - 1000), // expired, but already used
        usedAt: pastDate,
        user: { id: 'user-123', emailVerifiedAt: pastDate },
      });

      const result = await verifyEmail(rawToken);

      expect(result).toEqual({
        emailVerifiedAt: pastDate,
        alreadyVerified: true,
      });
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('verifyEmail — token and user update are atomic inside $transaction', async () => {
      emailTokenFindUnique.mockResolvedValue({
        id: 'token-row-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        user: { id: 'user-123', emailVerifiedAt: null },
      });

      transaction.mockRejectedValue(new Error('Transaction rollback'));

      await expect(verifyEmail(rawToken)).rejects.toThrow('Transaction rollback');
    });

    it('verifyEmail — double click: first marks verified, second returns soft 200', async () => {
      const firstVerifiedAt = new Date();
      // First call
      emailTokenFindUnique.mockResolvedValueOnce({
        id: 'token-row-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        user: { id: 'user-123', emailVerifiedAt: null },
      });

      const firstResult = await verifyEmail(rawToken);
      expect(firstResult.alreadyVerified).toBe(false);

      // Second call finds token already used
      emailTokenFindUnique.mockResolvedValueOnce({
        id: 'token-row-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: firstVerifiedAt,
        user: { id: 'user-123', emailVerifiedAt: firstVerifiedAt },
      });

      const secondResult = await verifyEmail(rawToken);
      expect(secondResult.alreadyVerified).toBe(true);
      expect(secondResult.emailVerifiedAt).toEqual(firstVerifiedAt);
    });
  });

  describe('resendVerificationEmail', () => {
    it('resendVerificationEmail — unverified user creates hashed token and sends email', async () => {
      userFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'a@x.com',
        emailVerifiedAt: null,
      });
      emailTokenCreate.mockResolvedValue({ id: 'token-2' });

      await resendVerificationEmail('a@x.com');

      expect(emailTokenCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );

      const createdHash = emailTokenCreate.mock.calls[0][0].data.tokenHash;
      expect(sendVerificationEmail).toHaveBeenCalledWith('a@x.com', expect.any(String));
      const sentRawToken = sendVerificationEmail.mock.calls[0][1];
      expect(createdHash).not.toBe(sentRawToken);
      expect(createdHash).toBe(hashToken(sentRawToken));
    });

    it('resendVerificationEmail — unknown email or already verified does nothing', async () => {
      // Unknown email
      userFindUnique.mockResolvedValueOnce(null);
      await resendVerificationEmail('unknown@x.com');
      expect(emailTokenCreate).not.toHaveBeenCalled();
      expect(sendVerificationEmail).not.toHaveBeenCalled();

      // Already verified
      userFindUnique.mockResolvedValueOnce({
        id: 'user-123',
        email: 'a@x.com',
        emailVerifiedAt: new Date(),
      });
      await resendVerificationEmail('a@x.com');
      expect(emailTokenCreate).not.toHaveBeenCalled();
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('resendVerificationEmail — same outward result (void, never throws)', async () => {
      userFindUnique.mockResolvedValueOnce(null);
      await expect(resendVerificationEmail('unknown@x.com')).resolves.toBeUndefined();

      userFindUnique.mockResolvedValueOnce({
        id: 'user-123',
        email: 'a@x.com',
        emailVerifiedAt: new Date(),
      });
      await expect(resendVerificationEmail('a@x.com')).resolves.toBeUndefined();

      userFindUnique.mockResolvedValueOnce({
        id: 'user-123',
        email: 'a@x.com',
        emailVerifiedAt: null,
      });
      await expect(resendVerificationEmail('a@x.com')).resolves.toBeUndefined();
    });

    it('resendVerificationEmail — provider failure does not leak and resolves cleanly', async () => {
      userFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'a@x.com',
        emailVerifiedAt: null,
      });
      sendVerificationEmail.mockRejectedValue(new Error('SMTP service down'));

      await expect(resendVerificationEmail('a@x.com')).resolves.toBeUndefined();

      // Logs must not leak token
      const logs = JSON.stringify(allLoggerCalls());
      const sentToken = sendVerificationEmail.mock.calls[0]?.[1];
      if (sentToken) {
        expect(logs).not.toContain(sentToken);
      }
    });

    it('resendVerificationEmail — token never logged', async () => {
      userFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'a@x.com',
        emailVerifiedAt: null,
      });

      await resendVerificationEmail('a@x.com');

      const sentToken = sendVerificationEmail.mock.calls[0][1];
      const logs = JSON.stringify(allLoggerCalls());
      expect(logs).not.toContain(sentToken);
    });
  });

  describe('requestPasswordReset', () => {
    it('requestPasswordReset — existing user creates token with config expiry and sends email', async () => {
      userFindUnique.mockResolvedValue({
        id: 'user-123',
        email: 'a@x.com',
      });
      passwordResetTokenCreate.mockResolvedValue({ id: 'pr-1' });

      const before = Date.now();
      await requestPasswordReset('a@x.com');
      const after = Date.now();

      expect(passwordResetTokenCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );

      const createdExpiry = passwordResetTokenCreate.mock.calls[0][0].data.expiresAt.getTime();
      // Default expiry is 1h = 3600000ms
      expect(createdExpiry).toBeGreaterThanOrEqual(before + 3600000);
      expect(createdExpiry).toBeLessThanOrEqual(after + 3600000);

      const createdHash = passwordResetTokenCreate.mock.calls[0][0].data.tokenHash;
      expect(sendPasswordResetEmail).toHaveBeenCalledWith('a@x.com', expect.any(String));
      const sentToken = sendPasswordResetEmail.mock.calls[0][1];
      expect(createdHash).toBe(hashToken(sentToken));
      expect(createdHash).not.toBe(sentToken);
    });

    it('requestPasswordReset — TTL comes from config (no hardcoded value)', async () => {
      userFindUnique.mockResolvedValue({ id: 'user-123', email: 'a@x.com' });

      const originalEnv = env.PASSWORD_RESET_TOKEN_EXPIRES_IN;
      try {
        (env as { PASSWORD_RESET_TOKEN_EXPIRES_IN?: string }).PASSWORD_RESET_TOKEN_EXPIRES_IN = '2h';
        const before = Date.now();
        await requestPasswordReset('a@x.com');
        const expiry = passwordResetTokenCreate.mock.calls[0][0].data.expiresAt.getTime();
        expect(expiry).toBeGreaterThanOrEqual(before + 7200000);
      } finally {
        (env as { PASSWORD_RESET_TOKEN_EXPIRES_IN?: string }).PASSWORD_RESET_TOKEN_EXPIRES_IN = originalEnv;
      }
    });

    it('requestPasswordReset — unknown email resolves without creating row or sending email', async () => {
      userFindUnique.mockResolvedValue(null);

      await expect(requestPasswordReset('unknown@x.com')).resolves.toBeUndefined();
      expect(passwordResetTokenCreate).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('requestPasswordReset — email failure does not leak and token not logged', async () => {
      userFindUnique.mockResolvedValue({ id: 'user-123', email: 'a@x.com' });
      sendPasswordResetEmail.mockRejectedValue(new Error('SES failed'));

      await expect(requestPasswordReset('a@x.com')).resolves.toBeUndefined();

      const sentToken = sendPasswordResetEmail.mock.calls[0][1];
      const logs = JSON.stringify(allLoggerCalls());
      expect(logs).not.toContain(sentToken);
    });

    it('requestPasswordReset — raw token not stored (stored tokenHash != raw token)', async () => {
      userFindUnique.mockResolvedValue({ id: 'user-123', email: 'a@x.com' });

      await requestPasswordReset('a@x.com');

      const storedHash = passwordResetTokenCreate.mock.calls[0][0].data.tokenHash;
      const sentToken = sendPasswordResetEmail.mock.calls[0][1];
      expect(storedHash).not.toBe(sentToken);
    });
  });

  describe('resetPassword', () => {
    const rawToken = 'raw-reset-token-xyz';
    const hashed = hashToken(rawToken);

    it('resetPassword — valid token updates password, consumes token and revokes all sessions in transaction (D-12)', async () => {
      passwordResetTokenFindUnique.mockResolvedValue({
        id: 'pr-token-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });

      const hashSpy = vi.spyOn(bcrypt, 'hash').mockResolvedValue('bcrypt-hashed-newpass' as never);

      await resetPassword(rawToken, 'newpass123');

      expect(passwordResetTokenFindUnique).toHaveBeenCalledWith({
        where: { tokenHash: hashed },
      });

      expect(transaction).toHaveBeenCalled();
      expect(passwordResetTokenUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pr-token-1' },
          data: { usedAt: expect.any(Date) },
        }),
      );
      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: { passwordHash: 'bcrypt-hashed-newpass' },
        }),
      );
      expect(refreshTokenUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', revokedAt: null },
          data: { revokedAt: expect.any(Date) },
        }),
      );

      hashSpy.mockRestore();
    });

    it('resetPassword — unknown token throws 400', async () => {
      passwordResetTokenFindUnique.mockResolvedValue(null);

      await expect(resetPassword('unknown-token', 'newpass123')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Invalid reset link',
      });
    });

    it('resetPassword — expired token throws 410 and does not update user', async () => {
      passwordResetTokenFindUnique.mockResolvedValue({
        id: 'pr-token-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      });

      await expect(resetPassword(rawToken, 'newpass123')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.GONE,
        message: 'This reset link has expired',
      });
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('resetPassword — used token throws 410 and does not update user', async () => {
      passwordResetTokenFindUnique.mockResolvedValue({
        id: 'pr-token-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(Date.now() - 5000),
      });

      await expect(resetPassword(rawToken, 'newpass123')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.GONE,
        message: 'This reset link has already been used',
      });
      expect(userUpdate).not.toHaveBeenCalled();
    });

    it('resetPassword — password too short throws 400 validation error without writing', async () => {
      passwordResetTokenFindUnique.mockResolvedValue({
        id: 'pr-token-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });

      await expect(resetPassword(rawToken, 'short')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: expect.stringMatching(/at least 8 characters/i),
      });
      expect(userUpdate).not.toHaveBeenCalled();
      expect(passwordResetTokenUpdate).not.toHaveBeenCalled();
    });

    it('resetPassword — double submit: second call throws 410', async () => {
      passwordResetTokenFindUnique.mockResolvedValueOnce({
        id: 'pr-token-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });

      await resetPassword(rawToken, 'newpass123');

      passwordResetTokenFindUnique.mockResolvedValueOnce({
        id: 'pr-token-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(),
      });

      await expect(resetPassword(rawToken, 'newpass123')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.GONE,
        message: 'This reset link has already been used',
      });
    });

    it('resetPassword — secrets never logged', async () => {
      passwordResetTokenFindUnique.mockResolvedValue({
        id: 'pr-token-1',
        userId: 'user-123',
        tokenHash: hashed,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });

      await resetPassword(rawToken, 'secret_new_password_999');

      const logs = JSON.stringify(allLoggerCalls());
      expect(logs).not.toContain(rawToken);
      expect(logs).not.toContain('secret_new_password_999');
    });
  });

  describe('changePassword', () => {
    it('changePassword — correct current password updates hash', async () => {
      userFindUnique.mockResolvedValue(baseUserRow);
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      const hashSpy = vi.spyOn(bcrypt, 'hash').mockResolvedValue('new-hash-xyz' as never);

      await changePassword('user-123', 'oldpassword1', 'newpassword1');

      expect(userFindUnique).toHaveBeenCalledWith({ where: { id: 'user-123' } });
      expect(compareSpy).toHaveBeenCalledWith('oldpassword1', baseUserRow.passwordHash);
      expect(userUpdate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { passwordHash: 'new-hash-xyz' },
      });

      compareSpy.mockRestore();
      hashSpy.mockRestore();
    });

    it('changePassword — wrong current password throws 400 and does not update', async () => {
      userFindUnique.mockResolvedValue(baseUserRow);
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(changePassword('user-123', 'wrongpassword', 'newpassword1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: 'Current password is incorrect',
      });

      expect(userUpdate).not.toHaveBeenCalled();

      compareSpy.mockRestore();
    });

    it('changePassword — verified before mutation (compare runs before update)', async () => {
      userFindUnique.mockResolvedValue(baseUserRow);
      const order: string[] = [];
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockImplementation(async () => {
        order.push('compare');
        return true;
      });
      userUpdate.mockImplementation(async () => {
        order.push('update');
        return baseUserRow;
      });

      await changePassword('user-123', 'oldpassword1', 'newpassword1');

      expect(order).toEqual(['compare', 'update']);

      compareSpy.mockRestore();
    });

    it('changePassword — new password too short throws 400 without update', async () => {
      userFindUnique.mockResolvedValue(baseUserRow);
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await expect(changePassword('user-123', 'oldpassword1', 'short')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        message: expect.stringMatching(/at least 8 characters/i),
      });

      expect(userUpdate).not.toHaveBeenCalled();

      compareSpy.mockRestore();
    });

    it('changePassword — secrets never logged or stored plaintext', async () => {
      userFindUnique.mockResolvedValue(baseUserRow);
      const compareSpy = vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await changePassword('user-123', 'old_secret_pass', 'new_secret_pass_123');

      const logs = JSON.stringify(allLoggerCalls());
      expect(logs).not.toContain('old_secret_pass');
      expect(logs).not.toContain('new_secret_pass_123');

      const updateCallStr = JSON.stringify(userUpdate.mock.calls);
      expect(updateCallStr).not.toContain('new_secret_pass_123');

      compareSpy.mockRestore();
    });
  });
});
