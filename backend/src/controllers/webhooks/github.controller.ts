import { Request, Response } from 'express';
import {
  verifyGitHubWebhookSignature,
  processWorkflowRunWebhook,
} from '../../services/github-webhook.service';
import { logger } from '../../lib/logger';

export async function handleWorkflowRun(req: Request, res: Response): Promise<void> {
  const rawBody = req.body as Buffer; // this route must use express.raw(), not express.json()
  const signature = req.header('X-Hub-Signature-256');
  const eventType = req.header('X-GitHub-Event');

  logger.info({ eventType }, 'github webhook received');

  if (!verifyGitHubWebhookSignature(rawBody, signature)) {
    logger.warn({ eventType }, 'github webhook rejected: invalid signature');
    res.status(401).json({
      statusCode: 401,
      success: false,
      message: 'Invalid webhook signature',
      data: null,
    });
    return;
  }

  logger.info({ eventType }, 'github webhook verified');

  // Acknowledge immediately — GitHub expects a fast response and retries
  // on timeout. Everything below runs after this response is already sent.
  res.status(200).json({
    statusCode: 200,
    success: true,
    message: 'Webhook received',
    data: null,
  });

  if (eventType !== 'workflow_run') {
    return; // acknowledged and ignored — not ours to handle
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    logger.error({ eventType }, 'github webhook processing failed: malformed JSON body');
    return;
  }

  if (event?.action !== 'completed') {
    return; // acknowledged and ignored — only a finished run is actionable
  }

  // Fire-and-forget: deliberately not awaited, so this handler's own
  // promise resolves right after the response above, not after processing.
  processWorkflowRunWebhook(event).catch((err) => {
    logger.error({ err, eventType }, 'github webhook processing failed');
  });
}
