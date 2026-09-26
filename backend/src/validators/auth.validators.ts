import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z
      .string({ message: 'Name must be at least 2 characters' })
      .trim()
      .min(2, 'Name must be at least 2 characters'),
    email: z
      .string({ message: 'Valid email is required' })
      .email('Invalid email address'),
    password: z
      .string({ message: 'Password must be at least 8 characters' })
      .min(8, 'Password must be at least 8 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ message: 'Valid email is required' })
      .email('Invalid email address'),
    password: z
      .string({ message: 'Password is required' })
      .min(1, 'Password is required'),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z
      .string({ message: 'Token is required' })
      .min(1, 'Token is required'),
  }),
});

export const emailOnlySchema = z.object({
  body: z.object({
    email: z
      .string({ message: 'Valid email is required' })
      .email('Invalid email address'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z
      .string({ message: 'Token is required' })
      .min(1, 'Token is required'),
    newPassword: z
      .string({ message: 'Password must be at least 8 characters' })
      .min(8, 'Password must be at least 8 characters'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z
      .string({ message: 'Current password is required' })
      .min(1, 'Current password is required'),
    newPassword: z
      .string({ message: 'Password must be at least 8 characters' })
      .min(8, 'Password must be at least 8 characters'),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>['body'];
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>['body'];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
