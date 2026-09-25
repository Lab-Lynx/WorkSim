import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  PASSWORD_MIN_LENGTH,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../../src/schemas/auth.schemas';

const validEmail = 'person@example.com';
const validPassword = 'password123';

function issuesFor(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) return result.error.issues;
  throw new Error('Expected schema validation to fail');
}

describe('auth schemas', () => {
  it('exports the password minimum length', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it('accepts valid inputs for every auth form', () => {
    expect(
      registerSchema.parse({ name: 'Ada Lovelace', email: validEmail, password: validPassword })
    ).toEqual({
      name: 'Ada Lovelace',
      email: validEmail,
      password: validPassword,
    });
    expect(loginSchema.parse({ email: validEmail, password: 'x' })).toEqual({
      email: validEmail,
      password: 'x',
    });
    expect(forgotPasswordSchema.parse({ email: validEmail })).toEqual({ email: validEmail });
    expect(resetPasswordSchema.parse({ newPassword: validPassword })).toEqual({
      newPassword: validPassword,
    });
    expect(
      changePasswordSchema.parse({ currentPassword: 'old', newPassword: validPassword })
    ).toEqual({
      currentPassword: 'old',
      newPassword: validPassword,
    });
    expect(updateProfileSchema.parse({ name: 'Ada' })).toEqual({ name: 'Ada' });
    expect(resendVerificationSchema.parse({ email: validEmail })).toEqual({ email: validEmail });
  });

  it('trims register and profile names and email addresses', () => {
    expect(
      registerSchema.parse({
        name: ' Ada ',
        email: ' person@example.com ',
        password: validPassword,
      })
    ).toEqual({
      name: 'Ada',
      email: validEmail,
      password: validPassword,
    });
    expect(updateProfileSchema.parse({ name: ' Ada ' })).toEqual({ name: 'Ada' });
  });

  it('reports exact register field-level validation messages', () => {
    const issues = issuesFor(registerSchema, { name: 'A', email: '', password: 'short' });
    expect(issues).toHaveLength(3);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['name'], message: 'Name must be at least 2 characters' }),
        expect.objectContaining({ path: ['email'], message: 'Email is required' }),
        expect.objectContaining({
          path: ['password'],
          message: 'Password must be at least 8 characters',
        }),
      ])
    );
  });

  it('rejects invalid emails in every email form', () => {
    for (const schema of [loginSchema, forgotPasswordSchema, resendVerificationSchema]) {
      expect(issuesFor(schema, { email: 'not-an-email', password: 'x' })).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['email'], message: 'Enter a valid email address' }),
        ])
      );
    }
  });

  it('requires a password on login but allows short login passwords', () => {
    expect(issuesFor(loginSchema, { email: validEmail, password: '' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['password'], message: 'Password is required' }),
      ])
    );
    expect(loginSchema.parse({ email: validEmail, password: 'x' }).password).toBe('x');
  });

  it.each([resetPasswordSchema, updateProfileSchema])(
    'rejects values below the required constraint',
    (schema) => {
      expect(
        schema.safeParse(schema === updateProfileSchema ? { name: ' ' } : { newPassword: 'short' })
          .success
      ).toBe(false);
    }
  );

  it('requires a non-empty current password and an eight-character new password', () => {
    const issues = issuesFor(changePasswordSchema, { currentPassword: '', newPassword: 'short' });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['currentPassword'],
          message: 'Current password is required',
        }),
        expect.objectContaining({
          path: ['newPassword'],
          message: 'Password must be at least 8 characters',
        }),
      ])
    );
  });

  it('rejects a whitespace-only profile name with the name message', () => {
    expect(issuesFor(updateProfileSchema, { name: '   ' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['name'], message: 'Name must be at least 2 characters' }),
      ])
    );
  });
});
