import { describe, expect, it } from 'vitest';
import {
  buildBranchUrl,
  buildRepoUrl,
  getGitHubOAuthErrorMessage,
  parseGitHubOAuthResult,
  shellQuote,
} from '@/lib/github';

describe('GitHub helpers', () => {
  describe('buildRepoUrl', () => {
    it('builds a GitHub URL for a valid owner and repository', () => {
      expect(buildRepoUrl('octo-org/work-sim')).toBe('https://github.com/octo-org/work-sim');
    });

    it.each([
      '',
      'octo-org',
      'octo-org/work sim',
      'octo-org/work/sim',
      'octo..org/work-sim',
      '../work-sim',
      'octo-org/..',
      'javascript:alert(1)/repo',
      'octo-org/%2Fwork-sim',
    ])('returns null for untrusted full name %j', (fullName) => {
      expect(buildRepoUrl(fullName)).toBeNull();
    });
  });

  describe('buildBranchUrl', () => {
    it('encodes a branch as one GitHub URL path segment', () => {
      expect(buildBranchUrl('octo-org/work-sim', "feature/O'Reilly fix")).toBe(
        'https://github.com/octo-org/work-sim/tree/feature%2FO%27Reilly%20fix'
      );
    });

    it.each(['', 'javascript:alert(1)', 'feature\nfix'])(
      'returns null for unsafe branch %j',
      (branch) => {
        expect(buildBranchUrl('octo-org/work-sim', branch)).toBeNull();
      }
    );
  });

  describe('OAuth callback parsing', () => {
    it('parses a successful callback without exposing unrelated parameters', () => {
      expect(
        parseGitHubOAuthResult(new URLSearchParams('github=connected&code=secret&reason=ignored'))
      ).toEqual({ status: 'connected' });
    });

    it.each(['state_invalid', 'scope_invalid', 'exchange_failed'])(
      'parses known failure %s',
      (reason) => {
        expect(
          parseGitHubOAuthResult(new URLSearchParams(`github=error&reason=${reason}`))
        ).toEqual({
          status: 'error',
          reason,
        });
      }
    );

    it('parses an unknown failure reason without making it a user-facing message', () => {
      const result = parseGitHubOAuthResult(
        new URLSearchParams('github=error&reason=token_leaked')
      );

      expect(result).toEqual({ status: 'error', reason: 'token_leaked' });
      expect(getGitHubOAuthErrorMessage(result?.status === 'error' ? result.reason : null)).toBe(
        "Couldn't connect to GitHub. Try again."
      );
      expect(getGitHubOAuthErrorMessage('token_leaked')).not.toContain('token_leaked');
    });

    it('returns null when the callback marker is absent or unknown', () => {
      expect(parseGitHubOAuthResult(new URLSearchParams())).toBeNull();
      expect(parseGitHubOAuthResult(new URLSearchParams('github=other'))).toBeNull();
    });
  });

  describe('getGitHubOAuthErrorMessage', () => {
    it.each([
      ['state_invalid', 'Authentication session expired. Try connecting again.'],
      [
        'scope_invalid',
        'Work Simulator needs repository permission to work on tickets. Try connecting again.',
      ],
      ['exchange_failed', "Couldn't connect to GitHub. Try again."],
      ['unexpected_backend_detail', "Couldn't connect to GitHub. Try again."],
      [null, "Couldn't connect to GitHub. Try again."],
    ])('maps %j to safe copy', (reason, message) => {
      expect(getGitHubOAuthErrorMessage(reason)).toBe(message);
    });
  });

  describe('shellQuote', () => {
    it('wraps values in single quotes and escapes inner single quotes', () => {
      expect(shellQuote("feature/O'Reilly fix")).toBe("'feature/O'\\''Reilly fix'");
    });
  });
});
