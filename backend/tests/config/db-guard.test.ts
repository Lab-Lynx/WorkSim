import { afterEach, describe, expect, it } from 'vitest';
import {
  assertSafeTestDatabaseUrl,
  isTestDatabaseName,
  UnsafeTestDatabaseError,
} from '../setup/db-guard.js';

describe('db-guard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('accepts local databases whose name has a test segment', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://postgres:postgres@localhost:5433/worksim_test'),
    ).not.toThrow();
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://postgres:postgres@127.0.0.1:5432/test_db'),
    ).not.toThrow();
  });

  it('rejects a missing URL', () => {
    expect(() => assertSafeTestDatabaseUrl(undefined)).toThrow(UnsafeTestDatabaseError);
  });

  it('rejects a local database that is not named like a test database', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://postgres:postgres@localhost:5433/template_db'),
    ).toThrow(/does not look like a test database/);
  });

  it('rejects remote hosts even when the name contains test', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://user:secret@db.example.com:5432/worksim_test'),
    ).toThrow(/is not local/);
  });

  it('allows a remote host only when it is explicitly allow-listed', () => {
    process.env.TEST_DATABASE_ALLOWED_HOSTS = 'db.internal, postgres';
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://user:secret@postgres:5432/worksim_test'),
    ).not.toThrow();
  });

  it('rejects non-postgres and unparseable URLs', () => {
    expect(() => assertSafeTestDatabaseUrl('mysql://root@localhost/app_test')).toThrow(
      /not a postgres URL/,
    );
    expect(() => assertSafeTestDatabaseUrl('not a url')).toThrow(/could not be parsed/);
  });

  it('rejects when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    expect(() =>
      assertSafeTestDatabaseUrl('postgresql://postgres:postgres@localhost:5433/worksim_test'),
    ).toThrow(/production/);
  });

  it('never leaks credentials in the error message', () => {
    try {
      assertSafeTestDatabaseUrl('postgresql://admin:hunter2@db.example.com:5432/prod');
    } catch (error) {
      expect((error as Error).message).not.toContain('hunter2');
      return;
    }
    throw new Error('expected the guard to throw');
  });

  it('recognises test database names by segment, not substring', () => {
    expect(isTestDatabaseName('worksim_test')).toBe(true);
    expect(isTestDatabaseName('test')).toBe(true);
    expect(isTestDatabaseName('test_db')).toBe(true);
    expect(isTestDatabaseName('my-test-db')).toBe(true);
    expect(isTestDatabaseName('latest')).toBe(false);
    expect(isTestDatabaseName('contest_prod')).toBe(false);
    expect(isTestDatabaseName('worksim')).toBe(false);
  });
});
