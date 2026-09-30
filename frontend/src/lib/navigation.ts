const DUMMY_ORIGIN = 'http://localhost';

function hasControlChar(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 0 && code <= 31) || code === 127) {
      return true;
    }
  }
  return false;
}

/**
 * Validates a redirect target to prevent open redirect vulnerabilities.
 * Only same-origin relative paths starting with a single '/' are accepted.
 * Protocol-relative URLs (//host, /\host), absolute URLs, control characters,
 * encoded newlines, and /login or /register paths are rejected and fall back.
 */
export function getSafeRedirectPath(
  raw: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (typeof raw !== 'string' || !raw) {
    return fallback;
  }

  // Reject literal control characters
  if (hasControlChar(raw)) {
    return fallback;
  }

  // Reject encoded control characters (e.g., encoded newlines %0A, %0D) and encoded slashes/backslashes
  try {
    const decoded = decodeURIComponent(raw);
    if (hasControlChar(decoded)) {
      return fallback;
    }
    if (decoded.startsWith('//') || decoded.startsWith('/\\')) {
      return fallback;
    }
  } catch {
    // Malformed percent-encoding
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw, DUMMY_ORIGIN);
  } catch {
    return fallback;
  }

  // The parsed origin must be unchanged, and raw must not be an absolute or protocol-relative URL
  if (
    parsed.origin !== DUMMY_ORIGIN ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.startsWith('/\\')
  ) {
    return fallback;
  }

  // Reject /login and /register paths to prevent redirect loops
  const normalizedPathname = parsed.pathname.replace(/\/+$/, '') || '/';
  if (normalizedPathname === '/login' || normalizedPathname === '/register') {
    return fallback;
  }

  return parsed.pathname + parsed.search + parsed.hash;
}

/**
 * Builds a login redirect URL for a visitor or logged-out user.
 * Preserves the safe original destination in the ?from= parameter.
 * Returns plain '/login' when the path is '/', '/login', '/register', or unsafe.
 */
export function buildLoginRedirect(currentPathAndSearch: string): string {
  if (typeof currentPathAndSearch !== 'string' || !currentPathAndSearch) {
    return '/login';
  }

  const UNSAFE_SENTINEL = '__UNSAFE_DESTINATION__';
  const safePath = getSafeRedirectPath(currentPathAndSearch, UNSAFE_SENTINEL);

  if (
    safePath === UNSAFE_SENTINEL ||
    safePath === '/' ||
    safePath.startsWith('/?') ||
    safePath.startsWith('/#')
  ) {
    return '/login';
  }

  return `/login?from=${encodeURIComponent(safePath)}`;
}
