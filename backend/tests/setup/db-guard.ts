/**
 * Safety rails for the test database.
 *
 * Integration suites TRUNCATE ... CASCADE the User table and everything that
 * hangs off it. If they ever run against a real database, every account is
 * wiped. These helpers make that impossible by refusing to run unless the
 * target is clearly a local, dedicated test database.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const TEST_DB_NAME = /(^|[_-])test($|[_-])/i;

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(`Refusing to run tests against this database: ${message}`);
    this.name = 'UnsafeTestDatabaseError';
  }
}

export function isTestDatabaseName(name: string): boolean {
  return TEST_DB_NAME.test(name);
}

function extraAllowedHosts(): string[] {
  return (process.env.TEST_DATABASE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Throws unless `url` points at a loopback (or explicitly allow-listed) host
 * and a database whose name contains a `test` segment, e.g. `worksim_test`.
 * Never echoes credentials in the error message.
 */
export function assertSafeTestDatabaseUrl(url: string | undefined): asserts url is string {
  if (!url) {
    throw new UnsafeTestDatabaseError('no test database URL is configured.');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new UnsafeTestDatabaseError('NODE_ENV is "production".');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeTestDatabaseError('the URL could not be parsed.');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new UnsafeTestDatabaseError('the URL is not a postgres URL.');
  }

  const host = parsed.hostname.toLowerCase();
  if (!LOOPBACK_HOSTS.has(host) && !extraAllowedHosts().includes(host)) {
    throw new UnsafeTestDatabaseError(
      `host "${host}" is not local. Tests may only target localhost, or a host listed in TEST_DATABASE_ALLOWED_HOSTS.`,
    );
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!isTestDatabaseName(dbName)) {
    throw new UnsafeTestDatabaseError(
      `database "${dbName}" does not look like a test database. Its name must contain a "test" segment (e.g. worksim_test).`,
    );
  }
}
