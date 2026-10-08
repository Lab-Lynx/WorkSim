import { Client } from 'pg';
import { beforeAll, expect } from 'vitest';
import { assertSafeTestDatabaseUrl, isTestDatabaseName, UnsafeTestDatabaseError } from './db-guard.js';

process.env.NODE_ENV ??= 'test';

// Tests never inherit DATABASE_URL from the shell, a .env file or a hosting
// dashboard. They only use TEST_DATABASE_URL (or the local default), and that
// URL must pass the guard before anything else can connect.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/worksim_test';
assertSafeTestDatabaseUrl(testDatabaseUrl);
process.env.DATABASE_URL = testDatabaseUrl;

process.env.ACCESS_TOKEN_SECRET ??= 'test_access_token_secret_placeholder_at_least_32_chars';
process.env.REFRESH_TOKEN_SECRET ??= 'test_refresh_token_secret_placeholder_at_least_32_chars';
process.env.CLIENT_URL ??= 'http://localhost:5173';
process.env.CHAPA_SECRET_KEY ??= 'test_chapa_secret_key';
process.env.CHAPA_WEBHOOK_SECRET ??= 'test_chapa_webhook_secret';
process.env.CHAPA_RETURN_URL ??= 'http://localhost:5173/subscription/return';
process.env.GITHUB_CLIENT_ID ??= 'test_github_client_id';
process.env.GITHUB_CLIENT_SECRET ??= 'test_github_client_secret';
process.env.GITHUB_CALLBACK_URL ??= 'http://localhost:3000/api/v1/github/callback';
process.env.GITHUB_TOKEN_ENCRYPTION_KEY ??= 'test_encryption_key_placeholder_32_bytes_len!';
process.env.GITHUB_WEBHOOK_SECRET ??= 'test_github_webhook_secret_here';
process.env.GITHUB_REQUESTED_SCOPE = 'repo,write:repo_hook';
process.env.GEMINI_API_KEY ??= 'test_gemini_api_key';
process.env.GROQ_API_KEY ??= 'test_groq_api_key';

// Second line of defence for integration suites: ask the server which database
// we are really connected to before any suite's own hooks can TRUNCATE.
beforeAll(async () => {
  const testPath = expect.getState().testPath ?? '';
  if (!testPath.includes('/integration/') && !testPath.includes('\\integration\\')) return;

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
  } catch {
    // Unreachable DB: the suite will fail on its own, and nothing can be truncated.
    return;
  }

  try {
    const { rows } = await client.query<{ db: string }>('SELECT current_database() AS db');
    const db = rows[0]?.db ?? '';
    if (!isTestDatabaseName(db)) {
      throw new UnsafeTestDatabaseError(
        `the server reports current_database() = "${db}", which is not a test database.`,
      );
    }
  } finally {
    await client.end().catch(() => {});
  }
});
