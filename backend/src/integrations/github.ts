/**
 * GitHub API adapter boundary (Doc 7 / Doc 8).
 * Real Octokit calls land in a later GitHub epic — default is a no-op success
 * so ticket lifecycle can be tested by mocking github.service.
 */
export const createBranch = async (input: {
  owner: string;
  repo: string;
  branchName: string;
  baseBranch: string;
  accessToken: string;
}): Promise<void> => {
  void input;
  // Intentionally empty until the GitHub integration epic wires Octokit.
};
