import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/github.service', () => ({
  createGitHubAuthorizeUrl: vi.fn(),
  handleGitHubCallback: vi.fn(),
  getGitHubConnection: vi.fn(),
  disconnectGitHub: vi.fn(),
  createStarterRepo: vi.fn(),
  GitHubCallbackError: class GitHubCallbackError extends Error {
    constructor(
      readonly category: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock('../../src/serializers/repo.serializer', () => ({
  serializeRepo: vi.fn((repo: any) => ({
    fullName: repo.fullName,
    starterTemplate: repo.starterTemplate,
    defaultBranch: repo.defaultBranch,
  })),
}));

import * as githubService from '../../src/services/github.service';
import { serializeRepo } from '../../src/serializers/repo.serializer';
import {
  connect,
  callback,
  getConnection,
  disconnect,
  createRepo,
} from '../../src/controllers/github.controller';

const { GitHubCallbackError } = githubService as any;

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CLIENT_URL = 'https://app.example.com';
});

describe('connect', () => {
  it('returns the authorize URL on success', async () => {
    (githubService.createGitHubAuthorizeUrl as any).mockResolvedValue(
      'https://github.com/oauth/authorize?x=1',
    );
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await connect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { authorizeUrl: 'https://github.com/oauth/authorize?x=1' } }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards errors to next() rather than handling them itself', async () => {
    const err = new Error('no paid access');
    (githubService.createGitHubAuthorizeUrl as any).mockRejectedValue(err);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await connect(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('callback', () => {
  it('redirects to ?github=connected on success', async () => {
    (githubService.handleGitHubCallback as any).mockResolvedValue(undefined);
    const req: any = { user: { id: 'user-1' }, query: { code: 'abc', state: 'xyz' } };
    const res = mockRes();
    const next = vi.fn();

    await callback(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith('https://app.example.com/github?github=connected');
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects with the specific failure category on a known GitHubCallbackError', async () => {
    (githubService.handleGitHubCallback as any).mockRejectedValue(
      new GitHubCallbackError('scope_invalid', 'scope too broad'),
    );
    const req: any = { user: { id: 'user-1' }, query: { code: 'abc', state: 'xyz' } };
    const res = mockRes();
    const next = vi.fn();

    await callback(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith(
      'https://app.example.com/github?github=error&reason=scope_invalid',
    );
  });

  it('redirects with a generic reason on a totally unexpected error, and never calls next or sends JSON', async () => {
    (githubService.handleGitHubCallback as any).mockRejectedValue(new Error('database exploded'));
    const req: any = { user: { id: 'user-1' }, query: { code: 'abc', state: 'xyz' } };
    const res = mockRes();
    const next = vi.fn();

    await callback(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith(
      'https://app.example.com/github?github=error&reason=exchange_failed',
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('never calls res.json under any circumstance', async () => {
    (githubService.handleGitHubCallback as any).mockResolvedValue(undefined);
    const req: any = { user: { id: 'user-1' }, query: { code: 'abc', state: 'xyz' } };
    const res = mockRes();
    const next = vi.fn();

    await callback(req, res, next);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('getConnection', () => {
  it('returns the connection summary', async () => {
    const summary = { connected: true, githubLogin: 'octocat', repo: null };
    (githubService.getGitHubConnection as any).mockResolvedValue(summary);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await getConnection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: summary }));
  });

  it('forwards errors to next()', async () => {
    const err = new Error('boom');
    (githubService.getGitHubConnection as any).mockRejectedValue(err);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await getConnection(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('disconnect', () => {
  it('returns 200 with null data on success', async () => {
    (githubService.disconnectGitHub as any).mockResolvedValue(undefined);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await disconnect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: null }));
  });

  it('forwards a 404-style error to next()', async () => {
    const err = new Error('not connected');
    (githubService.disconnectGitHub as any).mockRejectedValue(err);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await disconnect(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('createRepo', () => {
  it('calls the service with the validated body and returns the serialized repo', async () => {
    const created = {
      fullName: 'user/work-simulator',
      starterTemplate: 'react',
      defaultBranch: 'main',
      githubRepoId: '1',
    };
    (githubService.createStarterRepo as any).mockResolvedValue(created);

    const req: any = {
      user: { id: 'user-1' },
      body: { starterTemplate: 'react', repoName: 'work-simulator' },
    };
    const res = mockRes();
    const next = vi.fn();

    await createRepo(req, res, next);

    expect(githubService.createStarterRepo).toHaveBeenCalledWith(
      'user-1',
      'react',
      'work-simulator',
    );
    expect(serializeRepo).toHaveBeenCalledWith(created);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          repo: {
            fullName: 'user/work-simulator',
            starterTemplate: 'react',
            defaultBranch: 'main',
          },
        },
      }),
    );
  });

  it('never leaks githubRepoId through the response', async () => {
    const created = {
      fullName: 'user/repo',
      starterTemplate: 'react',
      defaultBranch: 'main',
      githubRepoId: '999',
    };
    (githubService.createStarterRepo as any).mockResolvedValue(created);

    const req: any = { user: { id: 'user-1' }, body: { starterTemplate: 'react' } };
    const res = mockRes();
    const next = vi.fn();

    await createRepo(req, res, next);

    const jsonArg = (res.json as any).mock.calls[0][0];
    expect(JSON.stringify(jsonArg)).not.toContain('999');
  });

  it('forwards service errors to next() (e.g. 409 collision)', async () => {
    const err = new Error('name collision');
    (githubService.createStarterRepo as any).mockRejectedValue(err);

    const req: any = { user: { id: 'user-1' }, body: { starterTemplate: 'react' } };
    const res = mockRes();
    const next = vi.fn();

    await createRepo(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
