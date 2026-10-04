import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import * as githubService from '../services/github.service.js';
import { hasPaidAccess } from '../services/subscription.service.js';
import type { StarterTemplate } from '@prisma/client';

export const connect = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  if (!(await hasPaidAccess(req.user.id))) {
    throw new ApiError(HTTP_STATUS.PAYMENT_REQUIRED, 'An active subscription is required');
  }
  const authorizeUrl = await githubService.createGitHubAuthorization(req.user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'GitHub authorization URL generated', { authorizeUrl }),
  );
});

export const callback = asyncHandler(async (req: Request, res: Response) => {
  const redirectUrl = await githubService.completeGitHubAuthorization(
    typeof req.query.state === 'string' ? req.query.state : undefined,
    typeof req.query.code === 'string' ? req.query.code : undefined,
  );
  res.redirect(redirectUrl);
});

export const getConnection = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  const connection = await githubService.getGitHubConnection(req.user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'GitHub connection retrieved', connection),
  );
});

export const disconnect = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  await githubService.disconnectGitHub(req.user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'GitHub disconnected successfully', null),
  );
});

export const createRepo = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  const { starterTemplate, repoName } = req.body as {
    starterTemplate: StarterTemplate;
    repoName?: string;
  };
  const repo = await githubService.createStarterRepo(
    req.user.id,
    starterTemplate,
    repoName,
  );
  res.status(HTTP_STATUS.CREATED).json(
    new SuccessResponse(HTTP_STATUS.CREATED, 'Starter repository created', { repo }),
  );
});
