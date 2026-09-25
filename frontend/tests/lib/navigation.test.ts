import { describe, expect, it } from 'vitest';
import { buildLoginRedirect, getSafeRedirectPath } from '@/lib/navigation';

describe('navigation helpers', () => {
  describe('getSafeRedirectPath', () => {
    describe('safe relative paths', () => {
      it('accepts safe relative paths', () => {
        expect(getSafeRedirectPath('/dashboard')).toBe('/dashboard');
        expect(getSafeRedirectPath('/tickets')).toBe('/tickets');
        expect(getSafeRedirectPath('/tickets/42')).toBe('/tickets/42');
      });

      it('preserves query strings and hashes on safe relative paths', () => {
        expect(getSafeRedirectPath('/tickets?status=open&sort=asc')).toBe(
          '/tickets?status=open&sort=asc'
        );
        expect(getSafeRedirectPath('/tickets/42?tab=activity#notes')).toBe(
          '/tickets/42?tab=activity#notes'
        );
      });

      it('accepts the root path /', () => {
        expect(getSafeRedirectPath('/')).toBe('/');
      });

      it('accepts paths that contain login or register as a substring but not exact pathname', () => {
        expect(getSafeRedirectPath('/login-help')).toBe('/login-help');
        expect(getSafeRedirectPath('/registered-users')).toBe('/registered-users');
      });

      it('handles very long safe relative paths without error', () => {
        const longPath = '/' + 'a'.repeat(2000);
        expect(getSafeRedirectPath(longPath)).toBe(longPath);
      });
    });

    describe('unsafe, external, and protocol-relative destinations', () => {
      it.each(['//evil.com', '//evil.com/path', '//localhost', '///evil.com', '////evil.com'])(
        'rejects protocol-relative URL %j',
        (url) => {
          expect(getSafeRedirectPath(url)).toBe('/dashboard');
        }
      );

      it.each(['/\\evil.com', '\\evil.com', '/\\', '/\\\\evil.com', '\\/evil.com'])(
        'rejects backslash-prefixed destinations %j',
        (url) => {
          expect(getSafeRedirectPath(url)).toBe('/dashboard');
        }
      );

      it.each([
        'https://evil.com',
        'http://evil.com',
        'http://evil.com/dashboard',
        'https://attacker.org/login',
        'http://localhost/dashboard',
        'http://localhost:3000/dashboard',
      ])('rejects absolute URLs %j', (url) => {
        expect(getSafeRedirectPath(url)).toBe('/dashboard');
      });

      it.each([
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'mailto:user@example.com',
        'vbscript:msgbox',
      ])('rejects non-http protocols %j', (url) => {
        expect(getSafeRedirectPath(url)).toBe('/dashboard');
      });

      it.each(['dashboard', 'tickets/42', '..', '../dashboard', './dashboard', 'http://[::1'])(
        'rejects non-leading-slash and invalid URLs %j',
        (url) => {
          expect(getSafeRedirectPath(url)).toBe('/dashboard');
        }
      );
    });

    describe('control characters and encoded control characters', () => {
      it.each([
        '/dashboard\n',
        '/dashboard\r',
        '/dashboard\t',
        '/tickets\u0000',
        '/tickets\u001fbad',
        '/tickets\u007f',
      ])('rejects raw control character in %j', (path) => {
        expect(getSafeRedirectPath(path)).toBe('/dashboard');
      });

      it.each([
        '/dashboard%0A',
        '/dashboard%0a',
        '/dashboard%0D',
        '/dashboard%0d',
        '/dashboard%0D%0A',
        '/dashboard%0d%0a',
        '/tickets%00bad',
        '/tickets%1F',
        '/tickets%7F',
      ])('rejects encoded newline/control character in %j', (path) => {
        expect(getSafeRedirectPath(path)).toBe('/dashboard');
      });

      it.each(['/%5cevil.com', '/%2fevil.com', '/%2f%2fevil.com'])(
        'rejects encoded slashes/backslashes that form external targets %j',
        (path) => {
          expect(getSafeRedirectPath(path)).toBe('/dashboard');
        }
      );

      it('rejects malformed percent encoding', () => {
        expect(getSafeRedirectPath('/dashboard%')).toBe('/dashboard');
        expect(getSafeRedirectPath('/dashboard%ZZ')).toBe('/dashboard');
      });
    });

    describe('/login and /register paths', () => {
      it.each([
        '/login',
        '/register',
        '/login/',
        '/register/',
        '/login?from=/tickets',
        '/register?plan=pro',
        '/login#top',
        '/register#form',
      ])('rejects %j to prevent redirect loops', (path) => {
        expect(getSafeRedirectPath(path)).toBe('/dashboard');
      });
    });

    describe('fallback handling', () => {
      it.each([null, undefined, ''])('returns default /dashboard for missing input %j', (input) => {
        expect(getSafeRedirectPath(input)).toBe('/dashboard');
      });

      it('uses custom fallback when provided', () => {
        expect(getSafeRedirectPath('//evil.com', '/custom-fallback')).toBe('/custom-fallback');
        expect(getSafeRedirectPath('/login', '/tickets')).toBe('/tickets');
        expect(getSafeRedirectPath(null, '/home')).toBe('/home');
        expect(getSafeRedirectPath(undefined, '/')).toBe('/');
      });

      it('returns safe path even if custom fallback is provided', () => {
        expect(getSafeRedirectPath('/tickets/1', '/custom-fallback')).toBe('/tickets/1');
      });
    });
  });

  describe('buildLoginRedirect', () => {
    it('builds login URL with encoded from parameter for safe path', () => {
      expect(buildLoginRedirect('/dashboard')).toBe('/login?from=%2Fdashboard');
      expect(buildLoginRedirect('/tickets/42')).toBe('/login?from=%2Ftickets%2F42');
    });

    it('preserves query strings and hashes in encoded from parameter', () => {
      expect(buildLoginRedirect('/tickets?status=open&sort=asc')).toBe(
        '/login?from=%2Ftickets%3Fstatus%3Dopen%26sort%3Dasc'
      );
      expect(buildLoginRedirect('/tickets/1?tab=logs#comments')).toBe(
        '/login?from=%2Ftickets%2F1%3Ftab%3Dlogs%23comments'
      );
    });

    it.each([
      '/',
      '/?from=/tickets',
      '/#top',
      '/login',
      '/register',
      '/login/',
      '/register/',
      '/login?from=/tickets',
      '/register?plan=pro',
    ])('returns plain /login for %j', (path) => {
      expect(buildLoginRedirect(path)).toBe('/login');
    });

    it.each([
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      'http://evil.com/dashboard',
      'javascript:alert(1)',
      '/tickets\n',
      '/tickets%0A',
      '',
    ])('returns plain /login for unsafe destination %j', (path) => {
      expect(buildLoginRedirect(path)).toBe('/login');
    });
  });
});
