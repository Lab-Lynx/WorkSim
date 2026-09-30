import 'dotenv/config';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';
import { hashToken } from '../../src/lib/crypto/token-hash.js';

/**
 * Doc 9 §9.3.6 — Auth Integration Tests
 * Covers register -> verify (incl. already-used soft success, expired 410),
 * resend non-enumeration, reset revokes all sessions, change-password wrong current password,
 * login rate limiting, session rotation, logout-all, unverified login, Bearer-only 401.
 */

const sendVerificationEmailMock = vi.fn();
const sendPasswordResetEmailMock = vi.fn();

vi.mock('../../src/services/email.service.js', () => ({
  sendVerificationEmail: (...args: unknown[]) => sendVerificationEmailMock(...args),
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
  sendPaymentFailedEmail: vi.fn(),
  sendRenewalReminderEmail: vi.fn(),
}));

const { default: app } = await import('../../src/app.js');
const { prisma } = await import('../../src/config/db.js');
const { authLimiter, defaultLimiter } = await import(
  '../../src/middlewares/rateLimiter.middleware.js'
);

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

function extractCookies(res: Response): Record<string, string> {
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const parsed: Record<string, string> = {};
  for (const str of setCookies) {
    const [nameVal] = str.split(';');
    if (nameVal) {
      const idx = nameVal.indexOf('=');
      if (idx !== -1) {
        parsed[nameVal.slice(0, idx).trim()] = nameVal.slice(idx + 1).trim();
      }
    }
  }
  return parsed;
}

function getSetCookieHeaders(res: Response): string[] {
  return typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
}

describeDb('auth.integration (Doc 9 §9.3.6)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  afterAll(async () => {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset rate limit counters between tests
    type ResettableLimiter = {
      resetKey?: (key: string) => Promise<void>;
    };
    const resetKeys = async (limiter: unknown) => {
      const resettable = limiter as ResettableLimiter;
      if (typeof resettable.resetKey === 'function') {
        await resettable.resetKey('127.0.0.1');
        await resettable.resetKey('::/56');
        await resettable.resetKey('::1');
      }
    };

    await resetKeys(authLimiter);
    await resetKeys(defaultLimiter);

    // Clean DB
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "Evaluation",
        "Submission",
        "MentorMessage",
        "Ticket",
        "Payment",
        "Subscription",
        "StarterRepo",
        "GitHubConnection",
        "EmailVerificationToken",
        "PasswordResetToken",
        "RefreshToken",
        "User"
      CASCADE
    `);
  });

  it('Register and login — 201 then 200 with httpOnly cookies and no tokens in response bodies', async () => {
    const email = `ada.${randomUUID()}@example.com`;
    const password = 'password123';

    // 1. POST register
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada Lovelace', email, password }),
    });

    expect(regRes.status).toBe(HTTP_STATUS.CREATED);
    const regBody = await regRes.json();
    expect(regBody).toMatchObject({
      statusCode: HTTP_STATUS.CREATED,
      success: true,
      message: 'User registered',
      data: {
        user: {
          name: 'Ada Lovelace',
          email,
          role: 'user',
          emailVerifiedAt: null,
        },
      },
    });

    // Verify no secret/token in body
    const regRawJson = JSON.stringify(regBody);
    expect(regRawJson).not.toContain('accessToken');
    expect(regRawJson).not.toContain('refreshToken');
    expect(regRawJson).not.toContain('passwordHash');

    // Verify cookies set on register
    const regCookieHeaders = getSetCookieHeaders(regRes);
    expect(regCookieHeaders.some((h) => h.includes('accessToken=') && /HttpOnly/i.test(h))).toBe(true);
    expect(regCookieHeaders.some((h) => h.includes('refreshToken=') && /HttpOnly/i.test(h) && /Path=\/api\/v1\/auth/i.test(h))).toBe(true);

    // 2. POST login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    expect(loginRes.status).toBe(HTTP_STATUS.OK);
    const loginBody = await loginRes.json();
    expect(loginBody).toMatchObject({
      statusCode: HTTP_STATUS.OK,
      success: true,
      message: 'Logged in',
      data: {
        user: {
          email,
          role: 'user',
        },
      },
    });

    // Verify no token in body
    const loginRawJson = JSON.stringify(loginBody);
    expect(loginRawJson).not.toContain('accessToken');
    expect(loginRawJson).not.toContain('refreshToken');
    expect(loginRawJson).not.toContain('passwordHash');

    // Verify cookies on login
    const loginCookieHeaders = getSetCookieHeaders(loginRes);
    expect(loginCookieHeaders.some((h) => h.includes('accessToken=') && /HttpOnly/i.test(h))).toBe(true);
    expect(loginCookieHeaders.some((h) => h.includes('refreshToken=') && /HttpOnly/i.test(h) && /Path=\/api\/v1\/auth/i.test(h))).toBe(true);
  });

  it('Duplicate email via the real constraint — returns 409 and leaves one user row', async () => {
    const email = `dup.${randomUUID()}@example.com`;
    const password = 'password123';

    // First register
    const res1 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User One', email, password }),
    });
    expect(res1.status).toBe(HTTP_STATUS.CREATED);

    // Second register with same email
    const res2 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User Two', email, password }),
    });
    expect(res2.status).toBe(HTTP_STATUS.CONFLICT);
    const body2 = await res2.json();
    expect(body2.message).toBe('Email already in use');

    // Verify DB count is still 1
    const userCount = await prisma.user.count({ where: { email } });
    expect(userCount).toBe(1);
  });

  it('Concurrent registration — one 201 and one 409; exactly one user row in DB', async () => {
    const email = `concurrent.${randomUUID()}@example.com`;
    const password = 'password123';

    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Race A', email, password }),
      }),
      fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Race B', email, password }),
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([HTTP_STATUS.CREATED, HTTP_STATUS.CONFLICT]);

    const userCount = await prisma.user.count({ where: { email } });
    expect(userCount).toBe(1);
  });

  it('Login errors are indistinguishable — unknown email vs wrong password', async () => {
    const email = `known.${randomUUID()}@example.com`;
    const password = 'correct-password-123';

    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Known', email, password }),
    });

    // 1. Unknown email
    const unknownRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `unknown.${randomUUID()}@example.com`, password }),
    });
    const unknownBody = await unknownRes.json();

    // 2. Wrong password
    const wrongRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'definitely-wrong-password' }),
    });
    const wrongBody = await wrongRes.json();

    expect(unknownRes.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(wrongRes.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(unknownBody).toEqual(wrongBody);
    expect(unknownBody).toMatchObject({
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      success: false,
      message: 'Invalid email or password',
    });
  });

  it('Unverified login allowed — user with emailVerifiedAt null logs in with 200 (Q-04)', async () => {
    const email = `unverified.${randomUUID()}@example.com`;
    const password = 'password123';

    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unverified User', email, password }),
    });

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.emailVerifiedAt).toBeNull();

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    expect(loginRes.status).toBe(HTTP_STATUS.OK);
    const body = await loginRes.json();
    expect(body.data.user.emailVerifiedAt).toBeNull();

    const cookies = extractCookies(loginRes);
    expect(cookies.accessToken).toBeDefined();
    expect(cookies.refreshToken).toBeDefined();
  });

  it('Email verification — register, verify (sets emailVerifiedAt), already-used soft success, expired 410', async () => {
    const email = `verify.${randomUUID()}@example.com`;
    const password = 'password123';

    // 1. Register triggers verification email
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Verify Me', email, password }),
    });
    expect(regRes.status).toBe(HTTP_STATUS.CREATED);

    expect(sendVerificationEmailMock).toHaveBeenCalledWith(email, expect.any(String));
    const rawToken = sendVerificationEmailMock.mock.calls[0][1];

    // 2. First verify call -> 200 OK and emailVerifiedAt set
    const verifyRes1 = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken }),
    });
    expect(verifyRes1.status).toBe(HTTP_STATUS.OK);
    const body1 = await verifyRes1.json();
    expect(body1).toMatchObject({
      statusCode: HTTP_STATUS.OK,
      success: true,
      message: 'Email verified',
      data: {
        emailVerifiedAt: expect.any(String),
      },
    });

    const verifiedUser = await prisma.user.findUnique({ where: { email } });
    expect(verifiedUser?.emailVerifiedAt).not.toBeNull();

    // 3. Second verify call with same token -> already-used soft success (200 OK)
    const verifyRes2 = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawToken }),
    });
    expect(verifyRes2.status).toBe(HTTP_STATUS.OK);
    const body2 = await verifyRes2.json();
    expect(body2.message).toBe('Email already verified');
    expect(body2.data.emailVerifiedAt).toBe(body1.data.emailVerifiedAt);

    // 4. Expired token -> 410 Gone and user remains unverified
    const expiredEmail = `expired.${randomUUID()}@example.com`;
    const expiredRawToken = 'expired-raw-token-12345';
    const expiredUser = await prisma.user.create({
      data: {
        email: expiredEmail,
        passwordHash: 'hash',
        emailVerifiedAt: null,
      },
    });
    await prisma.emailVerificationToken.create({
      data: {
        userId: expiredUser.id,
        tokenHash: hashToken(expiredRawToken),
        expiresAt: new Date(Date.now() - 3600000), // 1 hour in the past
      },
    });

    const expiredRes = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expiredRawToken }),
    });
    expect(expiredRes.status).toBe(HTTP_STATUS.GONE);
    const expiredBody = await expiredRes.json();
    expect(expiredBody.message).toBe('This verification link has expired');

    const checkExpiredUser = await prisma.user.findUnique({ where: { id: expiredUser.id } });
    expect(checkExpiredUser?.emailVerifiedAt).toBeNull();

    // 5. Unknown token -> 400 Bad Request
    const unknownRes = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'nonexistent-token' }),
    });
    expect(unknownRes.status).toBe(HTTP_STATUS.BAD_REQUEST);
  });

  it('Resend verification non-enumeration — identical response for existing vs nonexistent email', async () => {
    const unverifiedEmail = `resend.${randomUUID()}@example.com`;
    const password = 'password123';

    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Resend Test', email: unverifiedEmail, password }),
    });
    sendVerificationEmailMock.mockClear();

    // 1. Resend for existing unverified user
    const res1 = await fetch(`${baseUrl}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: unverifiedEmail }),
    });
    expect(res1.status).toBe(HTTP_STATUS.OK);
    const body1 = await res1.json();
    expect(sendVerificationEmailMock).toHaveBeenCalledWith(unverifiedEmail, expect.any(String));

    // 2. Resend for non-existent email
    sendVerificationEmailMock.mockClear();
    const nonExistentEmail = `notfound.${randomUUID()}@example.com`;
    const res2 = await fetch(`${baseUrl}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: nonExistentEmail }),
    });
    expect(res2.status).toBe(HTTP_STATUS.OK);
    const body2 = await res2.json();

    // Responses must be completely identical (non-enumerating)
    expect(body1).toEqual(body2);
    expect(body1.message).toBe(
      'If an unverified account exists for this email, a new verification link has been sent',
    );
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it('Concurrent refresh — two simultaneous refreshes with the same cookie yield one 200 and one 401', async () => {
    const email = `refresh-race.${randomUUID()}@example.com`;
    const password = 'password123';

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Refresh Race', email, password }),
    });
    const { refreshToken } = extractCookies(regRes);
    expect(refreshToken).toBeDefined();

    const [ref1, ref2] = await Promise.all([
      fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: `refreshToken=${refreshToken}` },
      }),
      fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: `refreshToken=${refreshToken}` },
      }),
    ]);

    const statuses = [ref1.status, ref2.status].sort();
    expect(statuses).toEqual([HTTP_STATUS.OK, HTTP_STATUS.UNAUTHORIZED]);
  });

  it('Reuse after rotation — refreshing with an old rotated cookie returns 401', async () => {
    const email = `reuse.${randomUUID()}@example.com`;
    const password = 'password123';

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Reuse Tester', email, password }),
    });
    const { refreshToken: initialRefresh } = extractCookies(regRes);

    // Refresh once -> succeeds with new refresh token
    const firstRefreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refreshToken=${initialRefresh}` },
    });
    expect(firstRefreshRes.status).toBe(HTTP_STATUS.OK);
    const { refreshToken: secondRefresh } = extractCookies(firstRefreshRes);
    expect(secondRefresh).toBeDefined();
    expect(secondRefresh).not.toBe(initialRefresh);

    // Refresh again with old initial token -> rejected 401
    const oldRefreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refreshToken=${initialRefresh}` },
    });
    expect(oldRefreshRes.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    const oldBody = await oldRefreshRes.json();
    expect(oldBody.message).toBe('Invalid or expired session');
  });

  it('Logout-all — revokes other sessions; refresh with old cookies is 401; rows kept with revokedAt set', async () => {
    const email = `logoutall.${randomUUID()}@example.com`;
    const password = 'password123';

    // Session A
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Logout All User', email, password }),
    });
    const sessionA = extractCookies(regRes);

    // Session B
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const sessionB = extractCookies(loginRes);

    const user = await prisma.user.findUnique({ where: { email } });
    const initialTokens = await prisma.refreshToken.findMany({ where: { userId: user!.id } });
    expect(initialTokens.length).toBe(2);

    // Call logout-all using session A
    const logoutAllRes = await fetch(`${baseUrl}/auth/logout-all`, {
      method: 'POST',
      headers: { Cookie: `accessToken=${sessionA.accessToken}` },
    });
    expect(logoutAllRes.status).toBe(HTTP_STATUS.OK);

    // Refresh with session B is now 401
    const refBRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refreshToken=${sessionB.refreshToken}` },
    });
    expect(refBRes.status).toBe(HTTP_STATUS.UNAUTHORIZED);

    // Verify token rows are retained in DB with revokedAt set (audit trail preserved)
    const afterTokens = await prisma.refreshToken.findMany({ where: { userId: user!.id } });
    expect(afterTokens.length).toBe(2);
    expect(afterTokens.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it('Password reset once only — first 200, second 410; password changed once', async () => {
    const email = `reset.${randomUUID()}@example.com`;
    const oldPassword = 'old-password-123';
    const newPassword = 'new-password-456';

    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Reset User', email, password: oldPassword }),
    });

    // Request reset link
    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    expect(forgotRes.status).toBe(HTTP_STATUS.OK);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(email, expect.any(String));
    const resetToken = sendPasswordResetEmailMock.mock.calls[0][1];

    // First reset -> 200 OK
    const resetRes1 = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, newPassword }),
    });
    expect(resetRes1.status).toBe(HTTP_STATUS.OK);
    const resetBody1 = await resetRes1.json();
    expect(resetBody1.message).toBe('Password reset');

    // Second reset with same token -> 410 Gone "This reset link has already been used"
    const resetRes2 = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, newPassword: 'another-password-789' }),
    });
    expect(resetRes2.status).toBe(HTTP_STATUS.GONE);
    const resetBody2 = await resetRes2.json();
    expect(resetBody2.message).toBe('This reset link has already been used');

    // Login with new password works
    const loginNewRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: newPassword }),
    });
    expect(loginNewRes.status).toBe(HTTP_STATUS.OK);

    // Login with old password fails
    const loginOldRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: oldPassword }),
    });
    expect(loginOldRes.status).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it('Reset revokes all sessions — active sessions are terminated upon password reset', async () => {
    const email = `revokesessions.${randomUUID()}@example.com`;
    const password = 'initial-password-123';
    const newPassword = 'new-secure-password-456';

    // Create session A
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Session Revoke', email, password }),
    });
    const sessionA = extractCookies(regRes);

    // Create session B
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const sessionB = extractCookies(loginRes);

    // Request reset
    await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const resetToken = sendPasswordResetEmailMock.mock.calls[0][1];

    // Perform reset
    const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, newPassword }),
    });
    expect(resetRes.status).toBe(HTTP_STATUS.OK);

    // Both previous refresh tokens are now revoked
    const refARes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refreshToken=${sessionA.refreshToken}` },
    });
    expect(refARes.status).toBe(HTTP_STATUS.UNAUTHORIZED);

    const refBRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refreshToken=${sessionB.refreshToken}` },
    });
    expect(refBRes.status).toBe(HTTP_STATUS.UNAUTHORIZED);

    // Token rows remain in DB with revokedAt populated
    const user = await prisma.user.findUnique({ where: { email } });
    const tokens = await prisma.refreshToken.findMany({ where: { userId: user!.id } });
    expect(tokens.length).toBeGreaterThanOrEqual(2);
    expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it('Change password — wrong current returns 400, correct current returns 200, login works with new password', async () => {
    const email = `changepw.${randomUUID()}@example.com`;
    const currentPassword = 'current-password-123';
    const newPassword = 'brand-new-password-789';

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Change PW', email, password: currentPassword }),
    });
    const { accessToken } = extractCookies(regRes);

    // 1. Wrong current password -> 400 Bad Request
    const wrongRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `accessToken=${accessToken}`,
      },
      body: JSON.stringify({ currentPassword: 'wrong-password-999', newPassword }),
    });
    expect(wrongRes.status).toBe(HTTP_STATUS.BAD_REQUEST);
    const wrongBody = await wrongRes.json();
    expect(wrongBody.message).toBe('Current password is incorrect');

    // 2. Correct current password -> 200 OK
    const correctRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `accessToken=${accessToken}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    expect(correctRes.status).toBe(HTTP_STATUS.OK);
    const correctBody = await correctRes.json();
    expect(correctBody.message).toBe('Password changed');

    // 3. Login with new password works
    const loginNewRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: newPassword }),
    });
    expect(loginNewRes.status).toBe(HTTP_STATUS.OK);

    // 4. Login with old password fails
    const loginOldRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: currentPassword }),
    });
    expect(loginOldRes.status).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it('Bearer-only request — valid access token in a Bearer header with no cookie returns 401', async () => {
    const email = `bearer.${randomUUID()}@example.com`;
    const password = 'password123';

    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bearer User', email, password }),
    });
    const { accessToken } = extractCookies(regRes);
    expect(accessToken).toBeDefined();

    // Call GET /users/me with Bearer token in header and NO cookies
    const res = await fetch(`${baseUrl}/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('Login rate limit — 429 once the limit is hit', async () => {
    const email = `ratelimit.${randomUUID()}@example.com`;
    const password = 'valid-password-123';

    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rate Limit User', email, password }),
    });

    type ResettableLimiter = {
      resetKey?: (key: string) => Promise<void>;
    };
    const authResettable = authLimiter as ResettableLimiter;
    await authResettable.resetKey?.('127.0.0.1');
    await authResettable.resetKey?.('::/56');
    await authResettable.resetKey?.('::1');

    // authLimiter has max: 10
    // Make 10 bad logins
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'wrong-password' }),
      });
      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    }

    // 11th bad login should hit the rate limiter (429)
    const blockedRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong-password' }),
    });

    expect(blockedRes.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
    const body = await blockedRes.json();
    expect(body.message).toBe('Too many login attempts, please try again later.');
  });
});
