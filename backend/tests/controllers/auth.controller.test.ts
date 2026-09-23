import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';
import ApiError from '../../src/utils/ApiError.js';

const registerUser = vi.fn();
const issueTokens = vi.fn();
const validateCredentials = vi.fn();
const rotateRefreshToken = vi.fn();
const revokeRefreshToken = vi.fn();
const revokeAllSessions = vi.fn();
const getUserById = vi.fn();
const verifyEmail = vi.fn();
const resendVerificationEmail = vi.fn();
const requestPasswordReset = vi.fn();
const resetPassword = vi.fn();
const changePassword = vi.fn();
const sendVerificationEmail = vi.fn();

vi.mock('../../src/services/auth.service.js', () => ({
  registerUser,
  issueTokens,
  validateCredentials,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllSessions,
  getUserById,
  verifyEmail,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
}));

vi.mock('../../src/services/email.service.js', () => ({
  sendVerificationEmail,
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('../../src/utils/cookies.js', () => ({
  setAuthCookies: vi.fn(),
  clearAuthCookies: vi.fn(),
  parseDurationToMs: vi.fn(() => 1000),
}));

const {
  register,
  logoutAll,
  verifyEmail: verifyEmailController,
  resendVerification,
  forgotPassword,
  resetPassword: resetPasswordController,
  changePassword: changePasswordController,
} = await import('../../src/controllers/auth.controller.js');

const { setAuthCookies, clearAuthCookies } = await import('../../src/utils/cookies.js');

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

const safeUser = {
  id: 'user-1',
  name: 'Ada',
  email: 'ada@example.com',
  role: 'user',
  emailVerifiedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('auth.controller (EP-06–EP-10 + register verification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    issueTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
  });

  it('register sends verification email and returns 201 User registered', async () => {
    registerUser.mockResolvedValue({
      user: { ...safeUser, passwordHash: 'secret' },
      verificationToken: 'raw-token',
    });
    sendVerificationEmail.mockResolvedValue(undefined);

    const req = { body: { name: 'Ada', email: 'ada@example.com', password: 'password1' } };
    const res = mockRes();
    const next = vi.fn();

    await register(req as never, res as never, next);

    expect(registerUser).toHaveBeenCalledWith('Ada', 'ada@example.com', 'password1');
    expect(sendVerificationEmail).toHaveBeenCalledWith('ada@example.com', 'raw-token');
    expect(setAuthCookies).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'User registered',
        data: {
          user: expect.objectContaining({
            id: 'user-1',
            name: 'Ada',
            email: 'ada@example.com',
          }),
        },
      }),
    );
    expect(res.json.mock.calls[0][0].data.user).not.toHaveProperty('passwordHash');
    expect(next).not.toHaveBeenCalled();
  });

  it('register still returns 201 when verification email fails', async () => {
    registerUser.mockResolvedValue({ user: safeUser, verificationToken: 'raw-token' });
    sendVerificationEmail.mockRejectedValue(new Error('smtp down'));

    const req = { body: { name: 'Ada', email: 'ada@example.com', password: 'password1' } };
    const res = mockRes();
    const next = vi.fn();

    await register(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
    expect(next).not.toHaveBeenCalled();
  });

  it('logoutAll revokes all sessions and clears cookies', async () => {
    revokeAllSessions.mockResolvedValue(undefined);

    const req = { user: { id: 'user-1', role: 'user' } };
    const res = mockRes();
    const next = vi.fn();

    await logoutAll(req as never, res as never, next);

    expect(revokeAllSessions).toHaveBeenCalledWith('user-1');
    expect(clearAuthCookies).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Logged out of all devices',
        data: null,
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('verifyEmail returns Email verified with timestamp', async () => {
    const verifiedAt = new Date('2026-02-01T00:00:00.000Z');
    verifyEmail.mockResolvedValue({ emailVerifiedAt: verifiedAt, alreadyVerified: false });

    const req = { body: { token: 'tok' } };
    const res = mockRes();
    const next = vi.fn();

    await verifyEmailController(req as never, res as never, next);

    expect(verifyEmail).toHaveBeenCalledWith('tok');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Email verified',
        data: { emailVerifiedAt: verifiedAt.toISOString() },
      }),
    );
  });

  it('verifyEmail soft-success uses already verified message', async () => {
    const verifiedAt = new Date('2026-02-01T00:00:00.000Z');
    verifyEmail.mockResolvedValue({ emailVerifiedAt: verifiedAt, alreadyVerified: true });

    const req = { body: { token: 'tok' } };
    const res = mockRes();
    const next = vi.fn();

    await verifyEmailController(req as never, res as never, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Email already verified' }),
    );
  });

  it('verifyEmail forwards 410 from the service to next', async () => {
    const err = new ApiError(HTTP_STATUS.GONE, 'This verification link has expired');
    verifyEmail.mockRejectedValue(err);

    const req = { body: { token: 'tok' } };
    const res = mockRes();
    const next = vi.fn();

    await verifyEmailController(req as never, res as never, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('resendVerification and forgotPassword return fixed non-enumerating messages', async () => {
    resendVerificationEmail.mockResolvedValue(undefined);
    requestPasswordReset.mockResolvedValue(undefined);

    const resendRes = mockRes();
    await resendVerification(
      { body: { email: 'a@example.com' } } as never,
      resendRes as never,
      vi.fn(),
    );
    expect(resendRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'If an unverified account exists for this email, a new verification link has been sent',
        data: null,
      }),
    );

    const forgotRes = mockRes();
    await forgotPassword(
      { body: { email: 'a@example.com' } } as never,
      forgotRes as never,
      vi.fn(),
    );
    expect(forgotRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'If an account exists for this email, a reset link has been sent',
        data: null,
      }),
    );
  });

  it('resetPassword returns Password reset', async () => {
    resetPassword.mockResolvedValue(undefined);

    const req = { body: { token: 'tok', newPassword: 'password1' } };
    const res = mockRes();
    const next = vi.fn();

    await resetPasswordController(req as never, res as never, next);

    expect(resetPassword).toHaveBeenCalledWith('tok', 'password1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Password reset', data: null }),
    );
  });

  it('changePassword uses req.user.id and ignores body userId', async () => {
    changePassword.mockResolvedValue(undefined);

    const req = {
      user: { id: 'user-1', role: 'user' },
      body: {
        currentPassword: 'oldpass12',
        newPassword: 'newpass12',
        userId: 'attacker',
      },
    };
    const res = mockRes();
    const next = vi.fn();

    await changePasswordController(req as never, res as never, next);

    expect(changePassword).toHaveBeenCalledWith('user-1', 'oldpass12', 'newpass12');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Password changed', data: null }),
    );
  });

  it('changePassword forwards wrong-current-password 400 to next', async () => {
    const err = new ApiError(HTTP_STATUS.BAD_REQUEST, 'Current password is incorrect');
    changePassword.mockRejectedValue(err);

    const req = {
      user: { id: 'user-1', role: 'user' },
      body: { currentPassword: 'wrong', newPassword: 'newpass12' },
    };
    const res = mockRes();
    const next = vi.fn();

    await changePasswordController(req as never, res as never, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(clearAuthCookies).not.toHaveBeenCalled();
  });
});
