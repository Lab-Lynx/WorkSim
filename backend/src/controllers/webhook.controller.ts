import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { HTTP_STATUS } from '../constants/index.js';
import { verifyChapaSignature, verifyGitHubSignature } from '../lib/webhooks/signature.js';
import logger from '../utils/logger.js';
import { logWebhookProcessingFailure, processChapaWebhook, processGitHubWebhook } from '../services/webhook.service.js';
import ApiError from '../utils/ApiError.js';
import { ErrorResponse, SuccessResponse } from '../utils/ApiResponse.js';

const rawBody = (req: Request): Buffer => {
  if (!Buffer.isBuffer(req.rawBody)) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid webhook payload');
  return req.rawBody;
};

export const receiveChapaWebhook = (req: Request, res: Response): void => {
  const body = rawBody(req);
  if (!verifyChapaSignature(body, req.get('x-chapa-signature'), env.CHAPA_WEBHOOK_SECRET)) {
    logger.warn({ provider: 'chapa', requestId: req.id }, 'Invalid Chapa webhook signature');
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(new ErrorResponse(HTTP_STATUS.UNAUTHORIZED, 'Invalid webhook signature', []));
    return;
  }

  let payload: { event?: string; status?: string; tx_ref?: string; data?: { status?: string; tx_ref?: string } };
  try {
    payload = JSON.parse(body.toString('utf8')) as typeof payload;
  } catch {
    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(new ErrorResponse(HTTP_STATUS.BAD_REQUEST, 'Invalid webhook payload', []));
    return;
  }
  const txRef = payload.tx_ref ?? payload.data?.tx_ref;
  const status = (payload.status ?? payload.data?.status ?? payload.event ?? 'unknown').toLowerCase();
  if (!txRef) {
    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(new ErrorResponse(HTTP_STATUS.BAD_REQUEST, 'Invalid webhook payload', []));
    return;
  }

  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'Webhook processed', null));
  void processChapaWebhook(payload, `${txRef}:${status}`).catch((error) => logWebhookProcessingFailure('chapa', error));
};

export const receiveGitHubWebhook = (req: Request, res: Response): void => {
  const body = rawBody(req);
  if (!verifyGitHubSignature(body, req.get('x-hub-signature-256'), env.GITHUB_WEBHOOK_SECRET)) {
    logger.warn({ provider: 'github', requestId: req.id }, 'Invalid GitHub webhook signature');
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(new ErrorResponse(HTTP_STATUS.UNAUTHORIZED, 'Invalid webhook signature', []));
    return;
  }
  const deliveryId = req.get('x-github-delivery');
  if (!deliveryId) {
    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(new ErrorResponse(HTTP_STATUS.BAD_REQUEST, 'Invalid webhook payload', []));
    return;
  }

  let payload: { action?: string; workflow_run?: { id?: number; head_sha?: string; conclusion?: string; html_url?: string }; repository?: { full_name?: string } };
  try {
    payload = JSON.parse(body.toString('utf8')) as typeof payload;
  } catch {
    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(new ErrorResponse(HTTP_STATUS.BAD_REQUEST, 'Invalid webhook payload', []));
    return;
  }
  const eventType = req.get('x-github-event') ?? '';
  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'Webhook received', null));
  void processGitHubWebhook(payload, deliveryId, eventType).catch((error) => logWebhookProcessingFailure('github', error));
};
