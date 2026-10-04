import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import * as githubService from '../services/github.service.js';
import { serializeRepo } from '../serializers/repo.serializer.js';

const requireUser = (req: AuthRequest) => {
  if (!req.user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  }
  return req.user;
};

/** EP-18: GET /github/connect */
export const connect = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const authorizeUrl = await githubService.createGitHubAuthorizeUrl(user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'GitHub authorization URL', {
      authorizeUrl,
    }),
  );
});

/** EP-19: GET /github/callback */
export const callback = asyncHandler(async (req: AuthRequest, res: Response) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const { code, state } = req.query as { code?: string; state?: string };

  try {
    const user = requireUser(req);
    await githubService.handleGitHubCallback(user.id, code ?? '', state ?? '');
    res.redirect(`${clientUrl}/github?github=connected`);
  } catch (err) {
    const category =
      err instanceof githubService.GitHubCallbackError ? err.category : 'exchange_failed';
    res.redirect(`${clientUrl}/github?github=error&reason=${category}`);
  }
});

/** EP-20: GET /github/connection */
export const getConnection = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const connection = await githubService.getGitHubConnection(user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'GitHub connection', connection),
  );
});

/** EP-21: DELETE /github/connection */
export const disconnect = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  await githubService.disconnectGitHub(user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'GitHub disconnected', null),
  );
});

/** EP-22: POST /github/repo */
export const createRepo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const { starterTemplate, repoName } = req.body;
  const repo = await githubService.createStarterRepo(user.id, starterTemplate, repoName);
  res.status(HTTP_STATUS.CREATED).json(
    new SuccessResponse(HTTP_STATUS.CREATED, 'Repository created', {
      repo: serializeRepo(repo),
    }),
  );
});
