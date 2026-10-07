export type GitHubOAuthResult =
  { status: 'connected' } | { status: 'error'; reason: string | null };

const GITHUB_ORIGIN = 'https://github.com';
const REPO_SEGMENT_PATTERN = /^[A-Za-z0-9_.-]+$/;

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replaceAll("'", '%27');
}

function getTrustedRepoSegments(fullName: string): [string, string] | null {
  const segments = fullName.split('/');

  if (
    segments.length !== 2 ||
    segments.some((segment) => !REPO_SEGMENT_PATTERN.test(segment) || segment.includes('..'))
  ) {
    return null;
  }

  return segments as [string, string];
}

export function buildRepoUrl(fullName: string): string | null {
  const segments = getTrustedRepoSegments(fullName);
  if (!segments) return null;

  return `${GITHUB_ORIGIN}/${segments.map(encodePathSegment).join('/')}`;
}

export function buildBranchUrl(fullName: string, branch: string): string | null {
  const repoUrl = buildRepoUrl(fullName);
  const hasControlCharacter = Array.from(branch).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });

  if (!repoUrl || !branch || hasControlCharacter || branch.includes(':')) {
    return null;
  }

  return `${repoUrl}/tree/${encodePathSegment(branch)}`;
}

export function parseGitHubOAuthResult(searchParams: URLSearchParams): GitHubOAuthResult | null {
  const status = searchParams.get('github');

  if (status === 'connected') return { status: 'connected' };
  if (status === 'error') return { status: 'error', reason: searchParams.get('reason') };
  return null;
}

export function getGitHubOAuthErrorMessage(reason: string | null): string {
  switch (reason) {
    case 'state_invalid':
      return 'Authentication session expired. Try connecting again.';
    case 'scope_invalid':
      return 'Work Simulator needs repository permission to work on tickets. Try connecting again.';
    case 'code_expired':
      return 'The GitHub sign-in link expired or was already used. Try connecting again.';
    case 'credentials_invalid':
      return 'GitHub rejected the app credentials. This is a server setup problem, so contact support.';
    case 'redirect_mismatch':
      return 'GitHub rejected the callback address. This is a server setup problem, so contact support.';
    case 'exchange_failed':
      return "Couldn't connect to GitHub. Try again.";
    default:
      return "Couldn't connect to GitHub. Try again.";
  }
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
