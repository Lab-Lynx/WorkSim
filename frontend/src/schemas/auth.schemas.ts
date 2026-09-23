import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_REQUIRED_MESSAGE = 'Email is required';
const INVALID_EMAIL_MESSAGE = 'Enter a valid email address';
const PASSWORD_MESSAGE = 'Password must be at least 8 characters';
const NAME_MESSAGE = 'Name must be at least 2 characters';

const emailSchema = z
  .string()
  .trim()
  .min(1, EMAIL_REQUIRED_MESSAGE)
  .pipe(z.email(INVALID_EMAIL_MESSAGE));

const nameSchema = z.string().trim().min(2, NAME_MESSAGE);
const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_MESSAGE);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: nameSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;