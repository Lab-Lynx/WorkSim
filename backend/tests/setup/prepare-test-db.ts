import { spawnSync } from 'node:child_process';
import { assertSafeTestDatabaseUrl } from './db-guard.js';

// Applies migrations to the dedicated test database only. The URL must pass the
// same guard the test run uses, so this can never migrate a real database.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/worksim_test';

assertSafeTestDatabaseUrl(testDatabaseUrl);

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});

process.exit(result.status ?? 1);
