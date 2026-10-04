import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptGitHubToken } from '../../src/lib/crypto/github-token.js';

const stateCreate = vi.fn();
const stateUpdateMany = vi.fn();
const stateFindUniqueOrThrow = vi.fn();
const connectionUpsert = vi.fn();
const exchangeOAuthCode = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    gitHubOAuthState: {
      create: stateCreate,
      updateMany: stateUpdateMany,
      findUniqueOrThrow: stateFindUniqueOrThrow,
    },
    gitHubConnection: { upsert: connectionUpsert },
  },
}));
vi.mock('../../src/integrations/github.js', () => ({
  exchangeOAuthCode,
  createBranch: vi.fn(),
}));

const { createGitHubAuthorization, completeGitHubAuthorization } = await import(
  '../../src/services/github.service.js'
);

describe('github OAuth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateCreate.mockResolvedValue({});
    stateUpdateMany.mockResolvedValue({ count: 1 });
    stateFindUniqueOrThrow.mockResolvedValue({ userId: 'user-1' });
    connectionUpsert.mockResolvedValue({});
  });

  it('creates a state-bound authorization URL without exposing the stored hash', async () => {
    const url = await createGitHubAuthorization('user-1');
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://github.com');
    expect(parsed.pathname).toBe('/login/oauth/authorize');
    expect(parsed.searchParams.get('state')).toHaveLength(43);
    expect(stateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          stateHash: expect.not.stringMatching(parsed.searchParams.get('state') as string),
        }),
      }),
    );
  });

  it('soft-fails missing or replayed state without exchanging a code', async () => {
    await expect(completeGitHubAuthorization(undefined, 'code')).resolves.toContain(
      'github=error',
    );
    stateUpdateMany.mockResolvedValue({ count: 0 });
    await expect(completeGitHubAuthorization('replayed', 'code')).resolves.toContain(
      'reason=state_invalid',
    );
    expect(exchangeOAuthCode).not.toHaveBeenCalled();
  });

  it('exchanges the code and stores the encrypted GitHub connection', async () => {
    exchangeOAuthCode.mockResolvedValue({
      accessToken: 'gho_secret',
      scope: 'write:repo_hook',
      githubUserId: '123',
      githubLogin: 'octocat',
    });

    await expect(completeGitHubAuthorization('state', 'code')).resolves.toContain(
      'github=connected',
    );
    expect(connectionUpsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: expect.objectContaining({
        userId: 'user-1',
        githubUserId: '123',
        githubLogin: 'octocat',
        scope: 'write:repo_hook',
        accessTokenEncrypted: expect.not.stringContaining('gho_secret'),
      }),
      update: expect.objectContaining({
        accessTokenEncrypted: expect.not.stringContaining('gho_secret'),
      }),
    });
    expect(encryptGitHubToken('gho_secret')).not.toBe(
      connectionUpsert.mock.calls[0][0].create.accessTokenEncrypted,
    );
  });
});
