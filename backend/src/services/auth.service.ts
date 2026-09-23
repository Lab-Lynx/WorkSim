import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { hashToken as hashRefreshToken } from '../utils/hashToken.js';
import { hashToken } from '../lib/crypto/token-hash.js';
import { parseDurationToMs } from '../utils/cookies.js';
import logger from '../utils/logger.js';
import * as emailService from './email.service.js';

/*
 * NOTE ON LAYERING: Prisma is called directly from this service until the
 * team decides on a repo layer (same deliberate open decision as before).
 */

export type SafeUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

const toSafeUser = (user: {
  id: string;
  name: string | null;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}): SafeUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  emailVerifiedAt: user.emailVerifiedAt,
  createdAt: user.createdAt,
});

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const verificationTokenTtl = () =>
  parseDurationToMs(env.VERIFICATION_TOKEN_EXPIRES_IN ?? '24h');

const passwordResetTokenTtl = () =>
  parseDurationToMs(env.PASSWORD_RESET_TOKEN_EXPIRES_IN ?? '1h');

const createRawToken = () => randomBytes(32).toString('hex');

export const registerUser = async (
  name: string,
  email: string,
  password: string,
): Promise<{ user: SafeUser; verificationToken: string }> => {
  const normalizedEmail = normalizeEmail(email);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'Email already in use');
  }

  const passwordHash = await bcrypt.hash(password, Number(env.BCRYPT_SALT_ROUNDS));
  const rawToken = createRawToken();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name, email: normalizedEmail, passwordHash },
        select: publicUserSelect,
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: created.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + verificationTokenTtl()),
        },
      });

      return created;
    });

    return { user: toSafeUser(user), verificationToken: rawToken };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Email already in use');
    }
    throw err;
  }
};

export const validateCredentials = async (
  email: string,
  password: string,
): Promise<SafeUser> => {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password');
  }

  let isValid = false;
  try {
    isValid = await bcrypt.compare(password, user.passwordHash);
  } catch {
    // Malformed stored hash must still fail with 401, not a 500
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password');
  }

  if (!isValid) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password');
  }

  return toSafeUser(user);
};

export const getUserById = async (id: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User no longer exists');
  }
  return toSafeUser(user);
};

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export const issueTokens = async (user: SafeUser): Promise<AuthTokens> => {
  const accessToken = generateAccessToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id });

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + parseDurationToMs(env.REFRESH_TOKEN_EXPIRES_IN)),
    },
  });

  return { accessToken, refreshToken };
};

export const rotateRefreshToken = async (rawRefreshToken: string): Promise<AuthTokens> => {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired session');
  }

  const now = new Date();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < now) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired session');
  }

  const updated = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: now },
  });

  if (updated.count === 0) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired session');
  }

  const user = await getUserById(payload.id);
  return issueTokens(user);
};

export const revokeRefreshToken = async (rawRefreshToken: string): Promise<void> => {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  await prisma.refreshToken
    .update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    })
    .catch(() => {
      // Token didn't exist / already gone — logout should still succeed.
    });
};

export const revokeAllSessions = async (userId: string): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export type VerifyEmailResult = {
  emailVerifiedAt: Date;
  alreadyVerified: boolean;
};

export const verifyEmail = async (rawToken: string): Promise<VerifyEmailResult> => {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, emailVerifiedAt: true } } },
  });

  if (!record) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid verification link');
  }

  if (record.usedAt || record.user.emailVerifiedAt) {
    const emailVerifiedAt = record.user.emailVerifiedAt ?? record.usedAt ?? new Date();
    return { emailVerifiedAt, alreadyVerified: true };
  }

  if (record.expiresAt < new Date()) {
    throw new ApiError(HTTP_STATUS.GONE, 'This verification link has expired');
  }

  const verifiedAt = new Date();
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: verifiedAt },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: verifiedAt },
    }),
  ]);

  return { emailVerifiedAt: verifiedAt, alreadyVerified: false };
};

export const resendVerificationEmail = async (email: string): Promise<void> => {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.emailVerifiedAt) {
    return;
  }

  const rawToken = createRawToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + verificationTokenTtl()),
    },
  });

  try {
    await emailService.sendVerificationEmail(user.email, rawToken);
  } catch (err) {
    // Non-enumerating endpoint — swallow send failures after token create.
    logger.error({ err, to: user.email }, 'Failed to send verification email');
  }
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return;
  }

  const rawToken = createRawToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + passwordResetTokenTtl()),
    },
  });

  try {
    await emailService.sendPasswordResetEmail(user.email, rawToken);
  } catch (err) {
    // Non-enumerating endpoint — swallow send failures.
    logger.error({ err, to: user.email }, 'Failed to send password reset email');
  }
};

export const resetPassword = async (rawToken: string, newPassword: string): Promise<void> => {
  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Password must be at least 8 characters');
  }

  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid reset link');
  }

  if (record.usedAt) {
    throw new ApiError(HTTP_STATUS.GONE, 'This reset link has already been used');
  }

  if (record.expiresAt < new Date()) {
    throw new ApiError(HTTP_STATUS.GONE, 'This reset link has expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, Number(env.BCRYPT_SALT_ROUNDS));
  const usedAt = new Date();

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: usedAt },
    }),
  ]);
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Password must be at least 8 characters');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User no longer exists');
  }

  let matches = false;
  try {
    matches = await bcrypt.compare(currentPassword, user.passwordHash);
  } catch {
    matches = false;
  }

  if (!matches) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, Number(env.BCRYPT_SALT_ROUNDS));
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
};

// Aliases matching Doc 8 §8.2 specifications
export const authenticateUser = validateCredentials;
export const revokeCurrentSession = revokeRefreshToken;
export const refreshSession = rotateRefreshToken;
