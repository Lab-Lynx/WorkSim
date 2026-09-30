import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger from '../../src/utils/logger.js';
import { env } from '../../src/config/env.js';

// We dynamically import after setting up mocks/spies if needed
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPaymentFailureEmail,
  sendRenewalReminderEmail,
  emailProvider,
} from '../../src/services/email.service.js';

describe('email.service (Doc 9 §9.2.3)', () => {
  let providerSpy: ReturnType<typeof vi.spyOn>;
  let loggerInfoSpy: ReturnType<typeof vi.spyOn>;
  let loggerErrorSpy: ReturnType<typeof vi.spyOn>;
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;
  let loggerDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    providerSpy = vi.spyOn(emailProvider, 'send').mockResolvedValue(undefined);
    loggerInfoSpy = vi.spyOn(logger, 'info').mockImplementation(() => logger);
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => logger);
    loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    loggerDebugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => logger);
  });

  afterEach(() => {
    providerSpy.mockRestore();
    loggerInfoSpy.mockRestore();
    loggerErrorSpy.mockRestore();
    loggerWarnSpy.mockRestore();
    loggerDebugSpy.mockRestore();
  });

  const getFullLogOutput = (): string => {
    const allCalls = [
      ...loggerInfoSpy.mock.calls,
      ...loggerErrorSpy.mock.calls,
      ...loggerWarnSpy.mock.calls,
      ...loggerDebugSpy.mock.calls,
    ];
    return JSON.stringify(allCalls);
  };

  describe('sendVerificationEmail', () => {
    it('sendVerificationEmail — content: provider called once with to and body contains verification URL', async () => {
      const recipient = 'a@x.com';
      const rawToken = 'rawtok-12345';
      const expectedUrl = `${env.CLIENT_URL.replace(/\/+$/, '')}/verify-email?token=${rawToken}`;

      await sendVerificationEmail(recipient, rawToken);

      expect(providerSpy).toHaveBeenCalledTimes(1);
      const payload = providerSpy.mock.calls[0][0];
      expect(payload.to).toBe(recipient);
      expect(payload.subject).toMatch(/verify/i);

      // Both html and text should contain the intended verification URL
      const combinedBody = `${payload.html} ${payload.text}`;
      expect(combinedBody).toContain(expectedUrl);
      expect(combinedBody).toContain(rawToken);
    });

    it('sendVerificationEmail — URL encodes special characters in raw token', async () => {
      const rawToken = 'raw+tok/special==';
      const encodedToken = encodeURIComponent(rawToken);
      const expectedUrl = `${env.CLIENT_URL.replace(/\/+$/, '')}/verify-email?token=${encodedToken}`;

      await sendVerificationEmail('user@test.com', rawToken);

      const payload = providerSpy.mock.calls[0][0];
      const combinedBody = `${payload.html} ${payload.text}`;
      expect(combinedBody).toContain(expectedUrl);
    });

    it('sendVerificationEmail — token not logged: no log call contains rawtok on success', async () => {
      const rawToken = 'super-secret-raw-verification-token';

      await sendVerificationEmail('a@x.com', rawToken);

      const logOutput = getFullLogOutput();
      expect(logOutput).not.toContain(rawToken);
    });

    it('sendVerificationEmail — token not logged: no log call contains rawtok on provider failure', async () => {
      const rawToken = 'super-secret-raw-verification-token-fail';
      providerSpy.mockRejectedValue(new Error('SMTP connection timed out'));

      await expect(sendVerificationEmail('a@x.com', rawToken)).rejects.toThrow('SMTP connection timed out');

      const logOutput = getFullLogOutput();
      expect(logOutput).not.toContain(rawToken);
    });

    it('sendVerificationEmail — provider failure: rejects with the provider error', async () => {
      const providerError = new Error('Provider connection failed');
      providerSpy.mockRejectedValue(providerError);

      await expect(sendVerificationEmail('a@x.com', 'rawtok')).rejects.toThrow(providerError);
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sendPasswordResetEmail — content and failure: body contains reset URL with token, token not logged', async () => {
      const recipient = 'a@x.com';
      const rawToken = 'reset-rawtok-987';
      const expectedUrl = `${env.CLIENT_URL.replace(/\/+$/, '')}/reset-password?token=${rawToken}`;

      await sendPasswordResetEmail(recipient, rawToken);

      expect(providerSpy).toHaveBeenCalledTimes(1);
      const payload = providerSpy.mock.calls[0][0];
      expect(payload.to).toBe(recipient);
      expect(payload.subject).toMatch(/reset/i);

      const combinedBody = `${payload.html} ${payload.text}`;
      expect(combinedBody).toContain(expectedUrl);
      expect(combinedBody).toContain(rawToken);

      const logOutput = getFullLogOutput();
      expect(logOutput).not.toContain(rawToken);
    });

    it('sendPasswordResetEmail — URL encodes special characters in raw token', async () => {
      const rawToken = 'reset+token/with%chars==';
      const encodedToken = encodeURIComponent(rawToken);
      const expectedUrl = `${env.CLIENT_URL.replace(/\/+$/, '')}/reset-password?token=${encodedToken}`;

      await sendPasswordResetEmail('a@x.com', rawToken);

      const payload = providerSpy.mock.calls[0][0];
      const combinedBody = `${payload.html} ${payload.text}`;
      expect(combinedBody).toContain(expectedUrl);
    });

    it('sendPasswordResetEmail — provider failure rejects and does not log token', async () => {
      const rawToken = 'reset-token-fail-123';
      const providerError = new Error('Email delivery rejected');
      providerSpy.mockRejectedValue(providerError);

      await expect(sendPasswordResetEmail('a@x.com', rawToken)).rejects.toThrow(providerError);

      const logOutput = getFullLogOutput();
      expect(logOutput).not.toContain(rawToken);
    });
  });

  describe('sendPaymentFailureEmail', () => {
    it('sendPaymentFailureEmail — content: includes access-end date and contains no payment secrets', async () => {
      const recipient = 'a@x.com';
      const endDate = new Date('2026-10-15T12:00:00.000Z');

      await sendPaymentFailureEmail(recipient, endDate);

      expect(providerSpy).toHaveBeenCalledTimes(1);
      const payload = providerSpy.mock.calls[0][0];
      expect(payload.to).toBe(recipient);
      expect(payload.subject).toMatch(/payment/i);

      const combinedBody = `${payload.html} ${payload.text}`;
      // Body includes the access-end date (formatted or ISO)
      expect(combinedBody).toMatch(/2026-10-15|October 15, 2026/);

      // Sentinel secret sweep: ensure no payment secrets, Chapa keys, or card numbers
      const sentinelSecrets = [
        env.CHAPA_SECRET_KEY,
        env.CHAPA_WEBHOOK_SECRET,
        'chapa_sec_',
        '4111111111111111',
        'chapaTxRef',
        'card_number',
      ];

      for (const secret of sentinelSecrets) {
        if (secret) {
          expect(combinedBody).not.toContain(secret);
        }
      }

      const logOutput = getFullLogOutput();
      for (const secret of sentinelSecrets) {
        if (secret) {
          expect(logOutput).not.toContain(secret);
        }
      }
    });

    it('sendPaymentFailureEmail — provider failure rejects', async () => {
      const endDate = new Date('2026-10-15T12:00:00.000Z');
      const providerError = new Error('Payment email provider outage');
      providerSpy.mockRejectedValue(providerError);

      await expect(sendPaymentFailureEmail('a@x.com', endDate)).rejects.toThrow(providerError);
    });
  });

  describe('sendRenewalReminderEmail', () => {
    it('sendRenewalReminderEmail — content: includes renewal date and contains no payment secrets', async () => {
      const recipient = 'a@x.com';
      const renewalDate = new Date('2026-10-22T08:30:00.000Z');

      await sendRenewalReminderEmail(recipient, renewalDate);

      expect(providerSpy).toHaveBeenCalledTimes(1);
      const payload = providerSpy.mock.calls[0][0];
      expect(payload.to).toBe(recipient);
      expect(payload.subject).toMatch(/renew/i);

      const combinedBody = `${payload.html} ${payload.text}`;
      expect(combinedBody).toMatch(/2026-10-22|October 22, 2026/);

      const sentinelSecrets = [
        env.CHAPA_SECRET_KEY,
        env.CHAPA_WEBHOOK_SECRET,
        'chapa_sec_',
        '4111111111111111',
      ];
      for (const secret of sentinelSecrets) {
        if (secret) {
          expect(combinedBody).not.toContain(secret);
        }
      }
    });

    it('sendRenewalReminderEmail — provider failure rejects', async () => {
      const renewalDate = new Date('2026-10-22T08:30:00.000Z');
      const providerError = new Error('Renewal reminder delivery failed');
      providerSpy.mockRejectedValue(providerError);

      await expect(sendRenewalReminderEmail('a@x.com', renewalDate)).rejects.toThrow(providerError);
    });
  });
});
