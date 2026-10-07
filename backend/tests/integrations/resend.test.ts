import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { sendResendEmail } = await import('../../src/integrations/resend.js');

const config = { apiKey: 're_test_key', from: 'WorkSim <noreply@example.com>' };
const input = {
  to: 'ada@example.com',
  subject: 'Verify your email',
  html: '<p>Hi</p>',
  text: 'Hi',
};

describe('sendResendEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts the message to Resend with the bearer key', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'email-1' }) });

    await expect(sendResendEmail(input, config)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer re_test_key' }),
        body: JSON.stringify({
          from: config.from,
          to: ['ada@example.com'],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      }),
    );
  });

  it('throws a bad gateway error when Resend rejects the message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ name: 'validation_error', message: 'domain not verified' }),
    });

    await expect(sendResendEmail(input, config)).rejects.toMatchObject({
      statusCode: 502,
      message: 'The email provider rejected the message',
    });
  });

  it('throws a bad gateway error when Resend is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(sendResendEmail(input, config)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Could not reach the email provider',
    });
  });
});
