import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import * as githubApi from '../integrations/github.js';

const GITHUB_NOT_CONNECTED = 'GitHub is not connected. Connect GitHub to continue';
const BRANCH_CREATE_FAILED =
  'Could not create the ticket branch on GitHub, please try again';

export const assertGitHubConnected = async (userId: string): Promise<void> => {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, GITHUB_NOT_CONNECTED);
  }
};

export const assertStarterRepo = async (userId: string) => {
  const repo = await prisma.starterRepo.findUnique({ where: { userId } });
  if (!repo) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'Create your starter repository before requesting a ticket',
    );
  }
  return repo;
};

/** Read-only repo summary for Ticket serialization (may be null). */
export const getStarterRepoSummary = async (
  userId: string,
): Promise<{ fullName: string; defaultBranch: string } | null> => {
  return prisma.starterRepo.findUnique({
    where: { userId },
    select: { fullName: true, defaultBranch: true },
  });
};

/**
 * Create the ticket branch on the user's starter repo (Doc 8 createTicketBranch).
 * Looks up connection + repo; delegates the API call to integrations/github.
 */
export const createTicketBranch = async (
  userId: string,
  branchName: string,
  baseBranch: string,
): Promise<void> => {
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, GITHUB_NOT_CONNECTED);
  }

  const repo = await prisma.starterRepo.findUnique({ where: { userId } });
  if (!repo) {
    throw new ApiError(
      HTTP_STATUS.CONFLICT,
      'Create your starter repository before requesting a ticket',
    );
  }

  const [owner, repoName] = repo.fullName.split('/');
  if (!owner || !repoName) {
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, BRANCH_CREATE_FAILED);
  }

  try {
    await githubApi.createBranch({
      owner,
      repo: repoName,
      branchName,
      baseBranch: baseBranch || repo.defaultBranch,
      accessToken: connection.accessTokenEncrypted,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, BRANCH_CREATE_FAILED);
  }
};
