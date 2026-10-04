import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import * as githubService from '../services/github.service.js';

export const connect = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  const authorizeUrl = await githubService.createGitHubAuthorization(req.user.id);
  res.status(HTTP_STATUS.OK).json({ statusCode: HTTP_STATUS.OK, data: { authorizeUrl } });
});

export const callback = asyncHandler(async (req: Request, res: Response) => {
  const redirectUrl = await githubService.completeGitHubAuthorization(
    typeof req.query.state === 'string' ? req.query.state : undefined,
    typeof req.query.code === 'string' ? req.query.code : undefined,
  );
  res.redirect(redirectUrl);
});
