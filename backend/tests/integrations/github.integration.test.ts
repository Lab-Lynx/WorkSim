import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDatabase, createTestUser } from '../helpers/db';

const mockRepos = { createUsingTemplate: vi.fn(), createWebhook: vi.fn() };
const mockUsers = { getAuthenticated: vi.fn() };

vi.mock('@octokit/rest', () => {
  class MockOctokit {
    repos = mockRepos;
    git = { getRef: vi.fn(), createRef: vi.fn() };
    pulls = { list: vi.fn(), create: vi.fn(), get: vi.fn() };
    users = mockUsers;
  }
  return { Octokit: MockOctokit };
});

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDatabase();
  process.env.CLIENT_URL = 'https://app.example.com';
  process.env.GITHUB_OAUTH_CLIENT_ID = 'client-id';
  process.env.GITHUB_OAUTH_CLIENT_SECRET = 'client-secret';
  process.env.GITHUB_WEBHOOK_URL = 'https://api.example.com/webhooks/github';
  process.env.GITHUB_WEBHOOK_SECRET = 'whsecret';
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Pulls the real `state` value out of a real /connect response, instead
// of hand-building one — this is what makes it a genuine integration test
// of the connect → callback pairing, not just two separately-faked calls.
function extractState(authorizeUrl: string): string {
  return new URL(authorizeUrl).searchParams.get('state')!;
}

describe('GitHub connection flow (integration)', () => {
  it('connect → callback → connection summary → disconnect (happy path)', async () => {
    const { agent, userId } = await createTestUser({ withActiveSubscription: true });

    const connectRes = await agent.get('/api/v1/github/connect').expect(200);
    const state = extractState(connectRes.body.data.authorizeUrl);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'gho_realistic_token',
        scope: 'public_repo write:repo_hook',
      }),
    }) as any;
    mockUsers.getAuthenticated.mockResolvedValue({ data: { id: 555, login: 'octocat' } });

    const callbackRes = await agent
      .get('/api/v1/github/callback')
      .query({ code: 'fake-code', state });

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('https://app.example.com/github?github=connected');

    // Real DB assertion — not a mock check. Proves the whole chain actually wrote a row.
    const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
    expect(connection).not.toBeNull();
    expect(connection!.accessTokenEncrypted).not.toBe('gho_realistic_token'); // must be encrypted, not raw
    expect(connection!.githubLogin).toBe('octocat');

    const summaryRes = await agent.get('/api/v1/github/connection').expect(200);
    expect(summaryRes.body.data).toEqual({ connected: true, githubLogin: 'octocat', repo: null });
    expect(JSON.stringify(summaryRes.body)).not.toContain('gho_realistic_token');

    await agent.delete('/api/v1/github/connection').expect(200);

    const afterDelete = await prisma.gitHubConnection.findUnique({ where: { userId } });
    expect(afterDelete).toBeNull();
  });

  it('scope_invalid: rejects a callback where granted scope exceeds requested scope, and writes nothing', async () => {
    const { agent, userId } = await createTestUser({ withActiveSubscription: true });

    const connectRes = await agent.get('/api/v1/github/connect').expect(200);
    const state = extractState(connectRes.body.data.authorizeUrl);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'gho_token',
        scope: 'public_repo write:repo_hook admin:org',
      }),
    }) as any;

    const callbackRes = await agent.get('/api/v1/github/callback').query({ code: 'code', state });

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe(
      'https://app.example.com/github?github=error&reason=scope_invalid',
    );

    const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
    expect(connection).toBeNull();
  });

  it('state_invalid: rejects a callback with a bogus state, and writes nothing', async () => {
    const { agent, userId } = await createTestUser({ withActiveSubscription: true });

    const callbackRes = await agent
      .get('/api/v1/github/callback')
      .query({ code: 'code', state: 'not-a-real-signed-state' });

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe(
      'https://app.example.com/github?github=error&reason=state_invalid',
    );

    const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
    expect(connection).toBeNull();
  });

  it('revoked token during repo creation: deletes the connection and returns 403', async () => {
    const { agent, userId } = await connectGitHubForTestUser();

    mockRepos.createUsingTemplate.mockRejectedValue({ status: 401 });

    const res = await agent.post('/api/v1/github/repo').send({ starterTemplate: 'react' });

    expect(res.status).toBe(403);

    const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
    expect(connection).toBeNull();
  });

  it('webhook registration failure: repo is not saved, even though it was created on GitHub', async () => {
    const { agent, userId } = await connectGitHubForTestUser();

    mockRepos.createUsingTemplate.mockResolvedValue({
      data: { id: 1, full_name: 'octocat/work-simulator', default_branch: 'main' },
    });
    mockRepos.createWebhook.mockRejectedValue(new Error('webhook boom'));

    const res = await agent.post('/api/v1/github/repo').send({ starterTemplate: 'react' });

    expect(res.status).toBe(502);

    const repo = await prisma.starterRepo.findUnique({ where: { userId } });
    expect(repo).toBeNull();
  });

  // Shared setup for tests that need an already-connected GitHub account
  async function connectGitHubForTestUser() {
    const { agent, userId } = await createTestUser({ withActiveSubscription: true });
    const connectRes = await agent.get('/api/v1/github/connect').expect(200);
    const state = extractState(connectRes.body.data.authorizeUrl);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'gho_token', scope: 'public_repo write:repo_hook' }),
    }) as any;
    mockUsers.getAuthenticated.mockResolvedValue({ data: { id: 1, login: 'octocat' } });

    await agent.get('/api/v1/github/callback').query({ code: 'code', state });
    return { agent, userId };
  }
});
