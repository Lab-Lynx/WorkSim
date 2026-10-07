import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import logger from '../utils/logger.js';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export interface ResendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface ResendConfig {
  apiKey: string;
  from: string;
}

export const sendResendEmail = async (
  input: ResendEmailInput,
  config: ResendConfig,
): Promise<void> => {
  let response: Response;
  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to reach Resend');
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not reach the email provider');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string; name?: string } | null;
    logger.error(
      { statusCode: response.status, resendError: body?.name, resendMessage: body?.message },
      'Resend rejected the email',
    );
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'The email provider rejected the message');
  }
};
