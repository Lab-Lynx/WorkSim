import { Request, Response } from 'express';
import { verifyChapaWebhookSignature } from '../../integrations/chapa';
import { processChapaWebhook } from '../../services/subscription.service';
import { logger } from '../../lib/logger';

export async function handleChapaWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = req.body as Buffer; // this route must use express.raw(), not express.json()
  const chapaSignature = req.header('chapa-signature');
  const xChapaSignature = req.header('x-chapa-signature');

  logger.info('chapa webhook received');

  const signatureValid = verifyChapaWebhookSignature(rawBody, {
    chapaSignature,
    xChapaSignature,
  });

  if (!signatureValid) {
    logger.warn('chapa webhook rejected: invalid signature');
    res.status(401).json({
      statusCode: 401,
      success: false,
      message: 'Invalid webhook signature',
      data: null,
    });
    return;
  }

  logger.info('chapa webhook verified');

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    logger.error('chapa webhook rejected: malformed JSON body');
    res.status(400).json({
      statusCode: 400,
      success: false,
      message: 'Invalid webhook payload',
      data: null,
    });
    return;
  }

  if (!payload?.tx_ref || !payload?.status) {
    logger.error('chapa webhook rejected: missing tx_ref or status');
    res.status(400).json({
      statusCode: 400,
      success: false,
      message: 'Invalid webhook payload',
      data: null,
    });
    return;
  }

  try {
    // Awaited, unlike the GitHub webhook — this work is lightweight DB
    // writes and (at most) an email send, not a slow external evaluator call.
    await processChapaWebhook(payload);
  } catch (err) {
    // Still acknowledge with 200: Chapa retries on anything else for up to
    // 72 hours, and processChapaWebhook already handles "unknown"/"repeated"
    // internally as no-ops rather than throwing. A genuinely unexpected
    // error here is logged for us to investigate, not surfaced to Chapa.
    logger.error({ err }, 'chapa webhook processing failed');
  }

  res.status(200).json({
    statusCode: 200,
    success: true,
    message: 'Webhook processed',
    data: null,
  });
}
