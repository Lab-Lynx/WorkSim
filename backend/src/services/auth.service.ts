import bcrypt from 'bcrypt';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { hashToken } from '../utils/hashToken.js';
import { parseDurationToMs } from '../utils/cookies.js';

/*
 * NOTE ON LAYERING: the `prisma.user.*` / `prisma.refreshToken.*` calls
 * below talk to the DB directly from this service, because the repo layer
 * pattern hasn't been decided yet (see project docs — deliberately left
 * open). Once it is, move these Prisma calls into a repository
 * (e.g. `userRepository`, `refreshTokenRepository`) and have this service
 * call the repository instead of `prisma` directly. Nothing about the
 * function signatures below needs to change for that move.
 *
 * NOTE ON SCOPE: register/login here are a minimal, working demo so the
 * cookie + refresh-token mechanism is actually testable end to end. Replace
 * with your real user model, validation rules, and business logic — this
 * is reference plumbing, not a finished feature.
 */

type SafeUser = {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
};

const toSafeUser = (user: {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
}): SafeUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

export const registerUser = async (email: string, password: string): Promise<SafeUser> => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, Number(env.BCRYPT_SALT_ROUNDS));

  const user = await prisma.user.create({
    data: { email, passwordHash },
  });

  return toSafeUser(user);
};

export const validateCredentials = async (
  email: string,
  password: string
): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({ where: { email } });

  // Same error for "no such user" and "wrong password" on purpose — don't
  // let a login form reveal which emails are registered.
  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password');
  }

  return toSafeUser(user);
};

export const getUserById = async (id: string): Promise<SafeUser> => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'User no longer exists');
  }
  return toSafeUser(user);
};

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues a fresh access+refresh pair for a user and stores the refresh
 * token's hash in the DB (so it can be revoked later).
 */
export const issueTokens = async (user: SafeUser): Promise<AuthTokens> => {
  const accessToken = generateAccessToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id });

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + parseDurationToMs(env.REFRESH_TOKEN_EXPIRES_IN)),
    },
  });

  return { accessToken, refreshToken };
};

/**
 * Verifies a refresh token both cryptographically (JWT signature/expiry)
 * AND against the DB (must exist, not be revoked, not be expired there
 * either). On success, revokes the old token and issues a brand new
 * access+refresh pair — this is "refresh token rotation": each refresh
 * token is single-use, so a stolen-and-reused token is detectable and the
 * old one is already dead.
 */
export const rotateRefreshToken = async (rawRefreshToken: string): Promise<AuthTokens> => {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Refresh token is no longer valid');
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const user = await getUserById(payload.id);
  return issueTokens(user);
};

/** Revokes a refresh token on logout. Safe to call even if it's already gone. */
export const revokeRefreshToken = async (rawRefreshToken: string): Promise<void> => {
  const tokenHash = hashToken(rawRefreshToken);
  await prisma.refreshToken
    .update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    })
    .catch(() => {
      // Token didn't exist / already gone — logout should still succeed.
    });
};
