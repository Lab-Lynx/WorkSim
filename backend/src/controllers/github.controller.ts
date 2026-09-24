import { Request, Response, NextFunction } from 'express';
import {
  createGitHubAuthorizeUrl,
  handleGitHubCallback,
  getGitHubConnection,
  disconnectGitHub,
  createStarterRepo,
  GitHubCallbackError,
} from '../services/github.service';
import { serializeRepo } from '../serializers/repo.serializer';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// GET /github/connect
export async function connect(req: Request, res: Response, next: NextFunction) {
  try {
    const authorizeUrl = await createGitHubAuthorizeUrl((req as any).user.id);
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'GitHub authorization URL',
      data: { authorizeUrl },
    });
  } catch (err) {
    next(err);
  }
}

// GET /github/callback
// This function must NEVER send JSON and must NEVER call next() —
// every path, success or failure, ends in a redirect, because GitHub
// sends the user's actual browser here directly.
export async function callback(req: Request, res: Response, _next: NextFunction) {
  const clientUrl = requireEnv('CLIENT_URL');
  const { code, state } = req.query as { code?: string; state?: string };

  try {
    await handleGitHubCallback((req as any).user.id, code ?? '', state ?? '');
    res.redirect(`${clientUrl}/github?github=connected`);
  } catch (err) {
    const category = err instanceof GitHubCallbackError ? err.category : 'exchange_failed';
    res.redirect(`${clientUrl}/github?github=error&reason=${category}`);
  }
}

// GET /github/connection
export async function getConnection(req: Request, res: Response, next: NextFunction) {
  try {
    const connection = await getGitHubConnection((req as any).user.id);
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'GitHub connection',
      data: connection,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /github/connection
export async function disconnect(req: Request, res: Response, next: NextFunction) {
  try {
    await disconnectGitHub((req as any).user.id);
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'GitHub disconnected',
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

// POST /github/repo
export async function createRepo(req: Request, res: Response, next: NextFunction) {
  try {
    const { starterTemplate, repoName } = req.body;
    const repo = await createStarterRepo((req as any).user.id, starterTemplate, repoName);
    res.status(201).json({
      statusCode: 201,
      success: true,
      message: 'Repository created',
      data: { repo: serializeRepo(repo) },
    });
  } catch (err) {
    next(err);
  }
}
