/**
 * Transactional email boundary (Doc 7 §7.2.10, Doc 8 §8.4, Doc 9 §9.2.3, FR-05–FR-08, FR-22).
 *
 * DESIGN DECISION (Recorded per Ticket BE-006):
 * 1. Template Library:
 *    - Pure TypeScript template modules (src/emails/verification, password-reset, payment).
 *    - Renders both rich, accessible HTML and clean plain-text fallback.
 *    - Zero external templating dependencies (no handlebars, ejs, or react-email needed in Node backend).
 *    - Full compile-time type safety with zero runtime asset/path bundling issues in Node ESM.
 * 2. Email Provider:
 *    - Decoupled `EmailProvider` interface (`emailProvider = { send(payload) }`).
 *    - Fully mockable and injectable via `setEmailProvider` or `emailProvider.send` spying in tests.
 *    - Production/staging transports connect via the provider boundary without changing domain callers.
 *    - Automated test suites mock the provider to ensure zero real network calls or test flakiness.
 *
 * PRIVACY & SECURITY RULES:
 * - Raw tokens may only appear inside the intended URLs ({CLIENT_URL}/verify-email?token=…, {CLIENT_URL}/reset-password?token=…).
 * - Raw tokens must NEVER be logged or persisted in plaintext.
 * - No sensitive payment data, Chapa secrets, or card details are ever logged or sent.
 * - Provider errors are propagated so callers can manage state/retry policies (e.g. registration non-blocking, renewal jobs).
 */

import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import { renderVerificationEmail } from '../emails/verification/verification-email.js';
import { renderPasswordResetEmail } from '../emails/password-reset/password-reset-email.js';
import { renderPaymentFailedEmail } from '../emails/payment/payment-failed-email.js';
import { renderRenewalReminderEmail } from '../emails/payment/renewal-reminder-email.js';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(payload: EmailPayload): Promise<void>;
}

/**
 * Pluggable email provider instance.
 * Defaults to logging dispatch in development/test.
 * In production or staging, this connects to the configured email transport.
 */
export const emailProvider: EmailProvider = {
  send: async (payload: EmailPayload): Promise<void> => {
    logger.debug({ to: payload.to, subject: payload.subject }, 'Email sent via default provider');
  },
};

export const setEmailProvider = (newProvider: EmailProvider): void => {
  emailProvider.send = newProvider.send;
};

/**
 * Send the email verification link to a user.
 * Doc 8 §8.4 / Doc 9 §9.2.3 / FR-05, FR-06.
 */
export const sendVerificationEmail = async (to: string, token: string): Promise<void> => {
  const baseUrl = env.CLIENT_URL.replace(/\/+$/, '');
  const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const rendered = renderVerificationEmail({ verificationUrl });

  try {
    await emailProvider.send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    logger.info({ to, kind: 'verification' }, 'Verification email dispatched');
  } catch (error) {
    logger.error({ to, kind: 'verification', err: error }, 'Failed to dispatch verification email');
    throw error;
  }
};

/**
 * Send the password reset link to a user.
 * Doc 8 §8.4 / Doc 9 §9.2.3 / FR-07, FR-08.
 */
export const sendPasswordResetEmail = async (to: string, token: string): Promise<void> => {
  const baseUrl = env.CLIENT_URL.replace(/\/+$/, '');
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const rendered = renderPasswordResetEmail({ resetUrl });

  try {
    await emailProvider.send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    logger.info({ to, kind: 'password_reset' }, 'Password reset email dispatched');
  } catch (error) {
    logger.error({ to, kind: 'password_reset', err: error }, 'Failed to dispatch password reset email');
    throw error;
  }
};

/**
 * Send a notification when a recurring subscription payment fails.
 * Doc 8 §8.4 / Doc 9 §9.2.3 / FR-22.
 */
export const sendPaymentFailureEmail = async (
  to: string,
  currentPeriodEnd: Date,
): Promise<void> => {
  const rendered = renderPaymentFailedEmail({ currentPeriodEnd });

  try {
    await emailProvider.send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    logger.info({ to, kind: 'payment_failure' }, 'Payment failure email dispatched');
  } catch (error) {
    logger.error({ to, kind: 'payment_failure', err: error }, 'Failed to dispatch payment failure email');
    throw error;
  }
};

/**
 * Send a transactional reminder 7 days before subscription renewal.
 * Doc 8 §8.4 / Doc 9 §9.2.3 / DR-11.
 */
export const sendRenewalReminderEmail = async (
  to: string,
  currentPeriodEnd: Date,
): Promise<void> => {
  const rendered = renderRenewalReminderEmail({ currentPeriodEnd });

  try {
    await emailProvider.send({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    logger.info({ to, kind: 'renewal_reminder' }, 'Renewal reminder email dispatched');
  } catch (error) {
    logger.error({ to, kind: 'renewal_reminder', err: error }, 'Failed to dispatch renewal reminder email');
    throw error;
  }
};
