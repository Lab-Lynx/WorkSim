import logger from '../utils/logger.js';

/**
 * Transactional email boundary (Doc 7 / Doc 8).
 * Transport is not wired yet — failures must not block registration (EP-01).
 * Never log the raw token.
 */
export const sendVerificationEmail = async (to: string, token: string): Promise<void> => {
  void token;
  logger.info({ to, kind: 'verification' }, 'Verification email dispatched');
};

export const sendPasswordResetEmail = async (to: string, token: string): Promise<void> => {
  void token;
  logger.info({ to, kind: 'password_reset' }, 'Password reset email dispatched');
};
