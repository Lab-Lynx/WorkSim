import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';


const completeGitHubAuthorization = vi.fn();
const createGitHubAuthorization = vi.fn();
const getGitHubConnection = vi.fn();
const disconnectGitHub = vi.fn();
const createStarterRepo = vi.fn();

vi.mock('../../src/services/github.service.js', () => ({
  createGitHubAuthorization,
  completeGitHubAuthorization,
  getGitHubConnection,
  disconnectGitHub,
  createStarterRepo,
}));

const hasPaidAccess = vi.fn();
vi.mock('../../src/services/subscription.service.js', () => ({
  hasPaidAccess,
}));

const { callback, connect, getConnection, disconnect, createRepo } = await import(
  '../../src/controllers/github.controller.js'
);

describe('github.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('throws 402 if user has no active subscription', async () => {
      hasPaidAccess.mockResolvedValue(false);
      const req = { user: { id: 'user-1' } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await connect(req as never, res as never, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HTTP_STATUS.PAYMENT_REQUIRED,
        }),
      );
    });

    it('returns an authorization URL with standard SuccessResponse for paid user', async () => {
      hasPaidAccess.mockResolvedValue(true);
      createGitHubAuthorization.mockResolvedValue('https://github.com/login/oauth/authorize?state=x');
      const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await connect({ user: { id: 'user-1' } } as never, response as never, vi.fn());

      expect(createGitHubAuthorization).toHaveBeenCalledWith('user-1');
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          success: true,
          data: { authorizeUrl: expect.stringContaining('github.com') },
        }),
      );
    });
  });

  describe('callback', () => {
    it('redirects callback results without exposing provider errors', async () => {
      completeGitHubAuthorization.mockResolvedValue(
        'http://localhost:5173/github?github=error&reason=state_invalid',
      );
      const response = { redirect: vi.fn() };

      await callback(
        { query: { state: 'state', code: 'code' } } as never,
        response as never,
        vi.fn(),
      );

      expect(completeGitHubAuthorization).toHaveBeenCalledWith('state', 'code');
      expect(response.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/github?github=error&reason=state_invalid',
      );
    });
  });

  describe('getConnection', () => {
    it('returns the user GitHub connection summary wrapped in SuccessResponse', async () => {
      const mockSummary = {
        connected: true,
        githubLogin: 'octocat',
        repo: {
          fullName: 'octocat/work-simulator',
          starterTemplate: 'react',
          defaultBranch: 'main',
        },
      };
      getGitHubConnection.mockResolvedValue(mockSummary);
      const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await getConnection({ user: { id: 'user-1' } } as never, response as never, vi.fn());

      expect(getGitHubConnection).toHaveBeenCalledWith('user-1');
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          success: true,
          data: mockSummary,
        }),
      );
    });
  });

  describe('disconnect', () => {
    it('disconnects GitHub and returns 200 SuccessResponse with null data', async () => {
      disconnectGitHub.mockResolvedValue(undefined);
      const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await disconnect({ user: { id: 'user-1' } } as never, response as never, vi.fn());

      expect(disconnectGitHub).toHaveBeenCalledWith('user-1');
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          success: true,
          data: null,
        }),
      );
    });
  });

  describe('createRepo', () => {
    it('creates starter repository and returns 201 SuccessResponse with repo', async () => {
      const mockRepo = {
        fullName: 'octocat/work-simulator',
        starterTemplate: 'react',
        defaultBranch: 'main',
      };
      createStarterRepo.mockResolvedValue(mockRepo);
      const req = {
        user: { id: 'user-1' },
        body: { starterTemplate: 'react', repoName: 'work-simulator' },
      };
      const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await createRepo(req as never, response as never, vi.fn());

      expect(createStarterRepo).toHaveBeenCalledWith('user-1', 'react', 'work-simulator');
      expect(response.status).toHaveBeenCalledWith(201);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 201,
          success: true,
          data: { repo: mockRepo },
        }),
      );
    });
  });
});

