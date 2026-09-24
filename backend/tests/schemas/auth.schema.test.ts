import { describe, expect, it } from 'vitest';
import {
  registerSchema,
  verifyEmailSchema,
  emailOnlySchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../../src/schemas/auth.schema.js';

describe('auth.schema (EP-06–EP-10)', () => {
  it('register requires name min 2 after trim', async () => {
    await expect(
      registerSchema.parseAsync({
        body: { name: 'A', email: 'a@example.com', password: 'password1' },
      }),
    ).rejects.toBeTruthy();

    const parsed = await registerSchema.parseAsync({
      body: { name: '  Ada  ', email: 'a@example.com', password: 'password1' },
    });
    expect(parsed.body.name).toBe('Ada');
  });

  it('verifyEmail requires a token', async () => {
    await expect(verifyEmailSchema.parseAsync({ body: { token: '' } })).rejects.toBeTruthy();
  });

  it('email-only schemas require a valid email', async () => {
    await expect(emailOnlySchema.parseAsync({ body: { email: 'nope' } })).rejects.toBeTruthy();
    await expect(
      emailOnlySchema.parseAsync({ body: { email: 'a@example.com' } }),
    ).resolves.toBeTruthy();
  });

  it('reset and change password require min 8 new password', async () => {
    await expect(
      resetPasswordSchema.parseAsync({ body: { token: 't', newPassword: 'short' } }),
    ).rejects.toBeTruthy();
    await expect(
      changePasswordSchema.parseAsync({
        body: { currentPassword: 'x', newPassword: 'short' },
      }),
    ).rejects.toBeTruthy();
  });
});
