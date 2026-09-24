import { describe, expect, it, vi } from 'vitest';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  emailOnlySchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../../src/validators/auth.validators.js';
import validate from '../../src/middlewares/validate.middleware.js';
import ApiError from '../../src/utils/ApiError.js';
import { HTTP_STATUS } from '../../src/constants/index.js';

describe('auth.validators (Doc 7 §7.2.4; Doc 8 §8.14; Doc 9 §9.3.5)', () => {
  describe('registerSchema', () => {
    it('rejects name of 1 character and whitespace-only name', async () => {
      const shortResult = registerSchema.safeParse({
        body: { name: 'A', email: 'ada@example.com', password: 'password123' },
      });
      expect(shortResult.success).toBe(false);
      if (!shortResult.success) {
        expect(shortResult.error.issues.some((i) => i.path.includes('name'))).toBe(true);
      }

      const spacesResult = registerSchema.safeParse({
        body: { name: '    ', email: 'ada@example.com', password: 'password123' },
      });
      expect(spacesResult.success).toBe(false);
      if (!spacesResult.success) {
        expect(spacesResult.error.issues.some((i) => i.path.includes('name'))).toBe(true);
      }
    });

    it('trims name and requires at least 2 characters', async () => {
      const parsed = await registerSchema.parseAsync({
        body: { name: '  Ada Lovelace  ', email: 'ada@example.com', password: 'password123' },
      });
      expect(parsed.body.name).toBe('Ada Lovelace');
    });

    it('rejects invalid email', async () => {
      const result = registerSchema.safeParse({
        body: { name: 'Ada Lovelace', email: 'invalid-email', password: 'password123' },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('email'))).toBe(true);
      }
    });

    it('rejects password under 8 characters with exact message "Password must be at least 8 characters"', async () => {
      const result = registerSchema.safeParse({
        body: { name: 'Ada Lovelace', email: 'ada@example.com', password: 'short12' },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('password'));
        expect(issue?.message).toBe('Password must be at least 8 characters');
      }
    });

    it('accepts a valid register payload', async () => {
      const valid = await registerSchema.parseAsync({
        body: { name: 'Ada Lovelace', email: 'ada@example.com', password: 'password123' },
      });
      expect(valid.body.name).toBe('Ada Lovelace');
      expect(valid.body.email).toBe('ada@example.com');
      expect(valid.body.password).toBe('password123');
    });
  });

  describe('loginSchema', () => {
    it('rejects login without password or with empty password', async () => {
      const missingPass = loginSchema.safeParse({
        body: { email: 'ada@example.com' },
      });
      expect(missingPass.success).toBe(false);
      if (!missingPass.success) {
        const issue = missingPass.error.issues.find((i) => i.path.includes('password'));
        expect(issue?.message).toBe('Password is required');
      }

      const emptyPass = loginSchema.safeParse({
        body: { email: 'ada@example.com', password: '' },
      });
      expect(emptyPass.success).toBe(false);
      if (!emptyPass.success) {
        const issue = emptyPass.error.issues.find((i) => i.path.includes('password'));
        expect(issue?.message).toBe('Password is required');
      }
    });

    it('rejects login with invalid email', async () => {
      const result = loginSchema.safeParse({
        body: { email: 'not-an-email', password: 'secretpassword' },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('email'))).toBe(true);
      }
    });

    it('accepts valid login payload', async () => {
      const valid = await loginSchema.parseAsync({
        body: { email: 'ada@example.com', password: 'secretpassword' },
      });
      expect(valid.body.email).toBe('ada@example.com');
      expect(valid.body.password).toBe('secretpassword');
    });
  });

  describe('verifyEmailSchema', () => {
    it('requires a token (rejects missing or empty token)', async () => {
      const missingToken = verifyEmailSchema.safeParse({
        body: {},
      });
      expect(missingToken.success).toBe(false);
      if (!missingToken.success) {
        const issue = missingToken.error.issues.find((i) => i.path.includes('token'));
        expect(issue?.message).toBe('Token is required');
      }

      const emptyToken = verifyEmailSchema.safeParse({
        body: { token: '' },
      });
      expect(emptyToken.success).toBe(false);
      if (!emptyToken.success) {
        const issue = emptyToken.error.issues.find((i) => i.path.includes('token'));
        expect(issue?.message).toBe('Token is required');
      }
    });

    it('accepts a valid token', async () => {
      const valid = await verifyEmailSchema.parseAsync({
        body: { token: 'valid-verify-token' },
      });
      expect(valid.body.token).toBe('valid-verify-token');
    });
  });

  describe('emailOnlySchema (resend-verification & forgot-password)', () => {
    it('rejects invalid or missing email', async () => {
      const missingEmail = emailOnlySchema.safeParse({
        body: {},
      });
      expect(missingEmail.success).toBe(false);

      const invalidEmail = emailOnlySchema.safeParse({
        body: { email: 'invalid-email' },
      });
      expect(invalidEmail.success).toBe(false);
      if (!invalidEmail.success) {
        expect(invalidEmail.error.issues.some((i) => i.path.includes('email'))).toBe(true);
      }
    });

    it('accepts valid email', async () => {
      const valid = await emailOnlySchema.parseAsync({
        body: { email: 'ada@example.com' },
      });
      expect(valid.body.email).toBe('ada@example.com');
    });
  });

  describe('resetPasswordSchema', () => {
    it('requires token', async () => {
      const missingToken = resetPasswordSchema.safeParse({
        body: { newPassword: 'validPassword123' },
      });
      expect(missingToken.success).toBe(false);
      if (!missingToken.success) {
        const issue = missingToken.error.issues.find((i) => i.path.includes('token'));
        expect(issue?.message).toBe('Token is required');
      }

      const emptyToken = resetPasswordSchema.safeParse({
        body: { token: '', newPassword: 'validPassword123' },
      });
      expect(emptyToken.success).toBe(false);
      if (!emptyToken.success) {
        const issue = emptyToken.error.issues.find((i) => i.path.includes('token'));
        expect(issue?.message).toBe('Token is required');
      }
    });

    it('rejects newPassword under 8 characters with exact message "Password must be at least 8 characters"', async () => {
      const shortPass = resetPasswordSchema.safeParse({
        body: { token: 'valid-token', newPassword: 'short12' },
      });
      expect(shortPass.success).toBe(false);
      if (!shortPass.success) {
        const issue = shortPass.error.issues.find((i) => i.path.includes('newPassword'));
        expect(issue?.message).toBe('Password must be at least 8 characters');
      }
    });

    it('accepts valid resetPassword payload', async () => {
      const valid = await resetPasswordSchema.parseAsync({
        body: { token: 'valid-token', newPassword: 'newValidPassword123' },
      });
      expect(valid.body.token).toBe('valid-token');
      expect(valid.body.newPassword).toBe('newValidPassword123');
    });
  });

  describe('changePasswordSchema', () => {
    it('requires currentPassword', async () => {
      const missingCurrent = changePasswordSchema.safeParse({
        body: { newPassword: 'validPassword123' },
      });
      expect(missingCurrent.success).toBe(false);
      if (!missingCurrent.success) {
        const issue = missingCurrent.error.issues.find((i) => i.path.includes('currentPassword'));
        expect(issue?.message).toBe('Current password is required');
      }

      const emptyCurrent = changePasswordSchema.safeParse({
        body: { currentPassword: '', newPassword: 'validPassword123' },
      });
      expect(emptyCurrent.success).toBe(false);
      if (!emptyCurrent.success) {
        const issue = emptyCurrent.error.issues.find((i) => i.path.includes('currentPassword'));
        expect(issue?.message).toBe('Current password is required');
      }
    });

    it('rejects newPassword under 8 characters with exact message "Password must be at least 8 characters"', async () => {
      const shortPass = changePasswordSchema.safeParse({
        body: { currentPassword: 'oldPassword123', newPassword: 'short12' },
      });
      expect(shortPass.success).toBe(false);
      if (!shortPass.success) {
        const issue = shortPass.error.issues.find((i) => i.path.includes('newPassword'));
        expect(issue?.message).toBe('Password must be at least 8 characters');
      }
    });

    it('accepts valid changePassword payload', async () => {
      const valid = await changePasswordSchema.parseAsync({
        body: { currentPassword: 'oldPassword123', newPassword: 'newValidPassword123' },
      });
      expect(valid.body.currentPassword).toBe('oldPassword123');
      expect(valid.body.newPassword).toBe('newValidPassword123');
    });
  });

  describe('integration with validate.middleware (Doc 8 §8.14; Doc 9 §9.3.5)', () => {
    it('register schema via validate middleware fails with 400 and field-specific errors', async () => {
      const middleware = validate(registerSchema);
      const req = {
        body: { name: 'A', email: 'invalid-email', password: 'short12' },
      };
      const res = {};
      const next = vi.fn();

      await middleware(req as never, res as never, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0] as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(err.message).toBe('Validation failed');
      expect(err.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('body.name: Name must be at least 2 characters'),
          expect.stringContaining('body.email: Invalid email address'),
          expect.stringContaining('body.password: Password must be at least 8 characters'),
        ]),
      );
    });

    it('login without password via validate middleware yields field-specific 400 error', async () => {
      const middleware = validate(loginSchema);
      const req = { body: { email: 'ada@example.com' } };
      const res = {};
      const next = vi.fn();

      await middleware(req as never, res as never, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0] as ApiError;
      expect(err.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(err.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('body.password: Password is required')]),
      );
    });

    it('verify without token via validate middleware yields field-specific 400 error', async () => {
      const middleware = validate(verifyEmailSchema);
      const req = { body: {} };
      const res = {};
      const next = vi.fn();

      await middleware(req as never, res as never, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0] as ApiError;
      expect(err.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(err.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('body.token: Token is required')]),
      );
    });

    it('reset password with 7 characters via validate middleware yields field-specific 400 error', async () => {
      const middleware = validate(resetPasswordSchema);
      const req = { body: { token: 'valid-token', newPassword: 'short12' } };
      const res = {};
      const next = vi.fn();

      await middleware(req as never, res as never, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0] as ApiError;
      expect(err.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(err.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('body.newPassword: Password must be at least 8 characters'),
        ]),
      );
    });

    it('change-password without current password via validate middleware yields field-specific 400 error', async () => {
      const middleware = validate(changePasswordSchema);
      const req = { body: { newPassword: 'validPassword123' } };
      const res = {};
      const next = vi.fn();

      await middleware(req as never, res as never, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0] as ApiError;
      expect(err.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(err.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('body.currentPassword: Current password is required'),
        ]),
      );
    });
  });
});
