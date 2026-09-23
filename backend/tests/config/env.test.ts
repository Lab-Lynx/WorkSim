import { beforeAll, describe, expect, it } from 'vitest';

let loadEnv: typeof import('../../src/config/env.js').loadEnv;

const requiredEnvironment = {
  DATABASE_URL: 'postgresql://localhost/worksim',
  ACCESS_TOKEN_SECRET: 'access-secret',
  REFRESH_TOKEN_SECRET: 'refresh-secret',
  CHAPA_SECRET_KEY: 'chapa-secret',
  CHAPA_WEBHOOK_SECRET: 'chapa-webhook-secret',
  CHAPA_RETURN_URL: 'https://example.com/payment/return',
  GITHUB_CLIENT_ID: 'github-client-id',
  GITHUB_CLIENT_SECRET: 'github-client-secret',
  GITHUB_CALLBACK_URL: 'https://example.com/auth/github/callback',
  GITHUB_TOKEN_ENCRYPTION_KEY: 'github-encryption-key',
  GEMINI_API_KEY: 'gemini-key',
  GROQ_API_KEY: 'groq-key',
  CLIENT_URL: 'https://example.com',
};

describe('loadEnv', () => {
  beforeAll(async () => {
    Object.assign(process.env, requiredEnvironment);
    ({ loadEnv } = await import('../../src/config/env.js'));
  });

  it('loads required provider configuration and typed boundary values', () => {
    const result = loadEnv({
      ...requiredEnvironment,
      CHAPA_PRICE: '100',
      CHAPA_CURRENCY: 'ETB',
      GITHUB_REQUESTED_SCOPE: 'repo,write:repo_hook',
      GEMINI_MODEL: 'pending-gemini-model',
      GROQ_MODEL: 'pending-groq-model',
      MENTOR_MESSAGE_MAX_CHARS: '1200',
      MENTOR_MESSAGES_PER_TICKET: '20',
      MENTOR_MESSAGE_WINDOW_MS: '86400000',
      VERIFICATION_TOKEN_EXPIRES_IN: '24h',
      PASSWORD_RESET_TOKEN_EXPIRES_IN: '1h',
      SUBMISSION_CI_TIMEOUT_MS: '600000',
      SUBMISSION_EVALUATOR_TIMEOUT_MS: '600000',
      AI_REQUEST_TIMEOUT_MS: '30000',
      BRANCH_NAME_PREFIX: 'ticket/',
    });

    expect(result.CHAPA_PRICE).toBe(100);
    expect(result.MENTOR_MESSAGES_PER_TICKET).toBe(20);
    expect(result.SUBMISSION_CI_TIMEOUT_MS).toBe(600000);
    expect(result.GITHUB_REQUESTED_SCOPE).toBe('repo,write:repo_hook');
    expect(result.BRANCH_NAME_PREFIX).toBe('ticket/');
  });

  it('keeps unresolved product values configurable and pending', () => {
    const result = loadEnv(requiredEnvironment);

    expect(result.CHAPA_PRICE).toBeUndefined();
    expect(result.MENTOR_MESSAGE_MAX_CHARS).toBeUndefined();
    expect(result.MENTOR_MESSAGES_PER_TICKET).toBeUndefined();
    expect(result.SUBMISSION_CI_TIMEOUT_MS).toBeUndefined();
  });

  it('fails when a required secret or URL is missing or invalid', () => {
    for (const key of ['CHAPA_SECRET_KEY', 'GITHUB_CLIENT_SECRET', 'GEMINI_API_KEY']) {
      const environment = { ...requiredEnvironment };
      delete environment[key as keyof typeof environment];

      expect(() => loadEnv(environment)).toThrow(/Invalid environment variables/);
    }

    expect(() => loadEnv({ ...requiredEnvironment, CHAPA_RETURN_URL: 'not-a-url' })).toThrow(
      /Invalid environment variables/,
    );
  });
});
