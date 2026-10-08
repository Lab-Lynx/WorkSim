import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../src/config/env.js';
import {
  collectApiKeys,
  isQuotaExhaustionMessage,
  markKeyExhausted,
  orderKeysByAvailability,
  parseRetryAfterMs,
  resetKeyCooldowns,
} from '../../src/integrations/api-keys.js';
import {
  callMentorModel,
  callTicketGenerationModel,
  GeminiRateLimitError,
  GeminiTimeoutError,
} from '../../src/integrations/gemini.js';
import {
  callEvaluatorModel,
  GroqOutageError,
  GroqRateLimitError,
} from '../../src/integrations/groq.js';
import type {
  EvaluationInput,
  MentorModelInput,
  TicketContent,
  TicketTemplate,
} from '../../src/types/domain.js';

const KEY_FIELDS = [
  'GEMINI_API_KEY',
  'GEMINI_API_KEY_2',
  'GEMINI_MENTOR_API_KEY',
  'GEMINI_MENTOR_API_KEY_2',
  'GEMINI_TICKET_API_KEY',
  'GEMINI_TICKET_API_KEY_2',
  'GROQ_API_KEY',
  'GROQ_API_KEY_2',
] as const;

const ticketContent: TicketContent = {
  title: 'Fix React hook dependency',
  scenario: 'useEffect is missing a dependency.',
  category: 'react',
  difficulty: 'easy',
  touchedFiles: ['src/App.tsx'],
  acceptanceCriteria: ['Dependency is added'],
  testChecklist: ['Verify state update'],
};

const mentorInput: MentorModelInput = {
  ticketContent,
  transcript: [],
  userMessage: 'I am stuck.',
  hintStage: 'conceptual_hint',
};

const template: TicketTemplate = {
  key: 'react-stale-closure',
  category: 'react',
  difficulty: 'easy',
  touchedFiles: ['src/App.tsx'],
  acceptanceCriteriaStructure: ['criteria 1'],
  testChecklistStructure: ['checklist 1'],
};

const evaluationInput: EvaluationInput = {
  attempt: 1,
  ticketContent,
  diff: '+ const a = 1;',
  ciPassed: true,
};

const failure = (status: number): Response =>
  ({ ok: false, status, json: async () => ({ error: { message: 'nope' } }) }) as unknown as Response;

const failureWithMessage = (status: number, message: string): Response =>
  ({ ok: false, status, json: async () => ({ error: { message } }) }) as unknown as Response;

const geminiText = (text: string): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }),
  }) as unknown as Response;

const groqFeedback = (): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        { message: { content: JSON.stringify({ feedback: 'Looks fine', scores: null }) }, finish_reason: 'stop' },
      ],
    }),
  }) as unknown as Response;

const usedGeminiKeys = (fetchMock: ReturnType<typeof vi.fn>): string[] =>
  fetchMock.mock.calls.map(
    (call) => ((call[1] as RequestInit).headers as Record<string, string>)['x-goog-api-key'],
  );

const usedGroqKeys = (fetchMock: ReturnType<typeof vi.fn>): string[] =>
  fetchMock.mock.calls.map((call) =>
    (((call[1] as RequestInit).headers as Record<string, string>).Authorization ?? '').replace('Bearer ', ''),
  );

describe('AI provider API key fallback', () => {
  let originalFetch: typeof globalThis.fetch;
  const originalKeys: Partial<Record<(typeof KEY_FIELDS)[number], string | undefined>> = {};

  beforeEach(() => {
    resetKeyCooldowns();
    originalFetch = globalThis.fetch;
    for (const field of KEY_FIELDS) {
      originalKeys[field] = env[field];
      env[field] = undefined as never;
    }
    env.GEMINI_API_KEY = 'shared-1';
    env.GROQ_API_KEY = 'groq-1';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const field of KEY_FIELDS) {
      env[field] = originalKeys[field] as never;
    }
    vi.restoreAllMocks();
  });

  describe('collectApiKeys', () => {
    it('drops blank, missing and duplicate keys while keeping order', () => {
      expect(collectApiKeys('a', undefined, '  ', 'b', 'a', ' c ')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('key cooldown helpers', () => {
    it('moves a recently exhausted key behind healthy ones without dropping it', () => {
      markKeyExhausted('a', 1_000, 0);
      expect(orderKeysByAvailability(['a', 'b'], 500)).toEqual(['b', 'a']);
      expect(orderKeysByAvailability(['a', 'b'], 1_500)).toEqual(['a', 'b']);
    });

    it('keeps the original order when every key is cooling down', () => {
      markKeyExhausted('a', 1_000, 0);
      markKeyExhausted('b', 1_000, 0);
      expect(orderKeysByAvailability(['a', 'b'], 500)).toEqual(['a', 'b']);
    });

    it('reads a numeric Retry-After header and ignores anything else', () => {
      const headers = (value: string | null) => ({ get: () => value });
      expect(parseRetryAfterMs(headers('30'))).toBe(30_000);
      expect(parseRetryAfterMs(headers('Wed, 21 Oct 2026 07:28:00 GMT'))).toBeUndefined();
      expect(parseRetryAfterMs(headers(null))).toBeUndefined();
      expect(parseRetryAfterMs(undefined)).toBeUndefined();
    });

    it('recognises quota and rate-limit wording but not unrelated errors', () => {
      expect(isQuotaExhaustionMessage('You exceeded your current quota')).toBe(true);
      expect(isQuotaExhaustionMessage('RESOURCE_EXHAUSTED')).toBe(true);
      expect(isQuotaExhaustionMessage('Rate limit reached for model')).toBe(true);
      expect(isQuotaExhaustionMessage('API key not valid')).toBe(false);
      expect(isQuotaExhaustionMessage('')).toBe(false);
    });
  });

  describe('exhausted key handling', () => {
    it('Gemini: tries the healthy key first on the next request after a key is exhausted', async () => {
      env.GEMINI_API_KEY_2 = 'shared-2';
      const first = vi
        .fn()
        .mockResolvedValueOnce(failure(429))
        .mockResolvedValueOnce(geminiText('First.'));
      globalThis.fetch = first;
      await callMentorModel(mentorInput);
      expect(usedGeminiKeys(first)).toEqual(['shared-1', 'shared-2']);

      const second = vi.fn().mockResolvedValue(geminiText('Second.'));
      globalThis.fetch = second;
      await callMentorModel(mentorInput);
      expect(usedGeminiKeys(second)).toEqual(['shared-2']);
    });

    it('Gemini: treats a 403 quota message as exhaustion and falls back', async () => {
      env.GEMINI_API_KEY_2 = 'shared-2';
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(failureWithMessage(403, 'You exceeded your current quota'))
        .mockResolvedValueOnce(geminiText('Hint.'));
      globalThis.fetch = fetchMock;

      await expect(callMentorModel(mentorInput)).resolves.toBe('Hint.');
      expect(usedGeminiKeys(fetchMock)).toEqual(['shared-1', 'shared-2']);
    });

    it('Gemini: reports a rate-limit error when every key reports exhausted quota', async () => {
      env.GEMINI_API_KEY_2 = 'shared-2';
      globalThis.fetch = vi.fn().mockResolvedValue(failureWithMessage(403, 'Quota exceeded for metric'));

      await expect(callMentorModel(mentorInput)).rejects.toThrow(GeminiRateLimitError);
    });

    it('Groq: tries the healthy key first on the next request after a key is exhausted', async () => {
      env.GROQ_API_KEY_2 = 'groq-2';
      const first = vi.fn().mockResolvedValueOnce(failure(429)).mockResolvedValueOnce(groqFeedback());
      globalThis.fetch = first;
      await callEvaluatorModel(evaluationInput);
      expect(usedGroqKeys(first)).toEqual(['groq-1', 'groq-2']);

      const second = vi.fn().mockResolvedValue(groqFeedback());
      globalThis.fetch = second;
      await callEvaluatorModel(evaluationInput);
      expect(usedGroqKeys(second)).toEqual(['groq-2']);
    });

    it('Groq: treats a non-429 quota message as exhaustion and falls back', async () => {
      env.GROQ_API_KEY_2 = 'groq-2';
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(failureWithMessage(403, 'Rate limit reached for model on tokens per day'))
        .mockResolvedValueOnce(groqFeedback());
      globalThis.fetch = fetchMock;

      await callEvaluatorModel(evaluationInput);
      expect(usedGroqKeys(fetchMock)).toEqual(['groq-1', 'groq-2']);
    });
  });

  describe('Gemini mentor', () => {
    it('uses the mentor key first and falls back to the second mentor key on rate limit', async () => {
      env.GEMINI_MENTOR_API_KEY = 'mentor-1';
      env.GEMINI_MENTOR_API_KEY_2 = 'mentor-2';
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(failure(429))
        .mockResolvedValueOnce(geminiText('Think about the closure.'));
      globalThis.fetch = fetchMock;

      await expect(callMentorModel(mentorInput)).resolves.toBe('Think about the closure.');
      expect(usedGeminiKeys(fetchMock)).toEqual(['mentor-1', 'mentor-2']);
    });

    it('falls through to the shared keys after the mentor keys are exhausted', async () => {
      env.GEMINI_MENTOR_API_KEY = 'mentor-1';
      env.GEMINI_API_KEY_2 = 'shared-2';
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(failure(429))
        .mockResolvedValueOnce(failure(403))
        .mockResolvedValueOnce(geminiText('Hint.'));
      globalThis.fetch = fetchMock;

      await expect(callMentorModel(mentorInput)).resolves.toBe('Hint.');
      expect(usedGeminiKeys(fetchMock)).toEqual(['mentor-1', 'shared-1', 'shared-2']);
    });

    it('throws the last error once every key has failed', async () => {
      env.GEMINI_API_KEY_2 = 'shared-2';
      const fetchMock = vi.fn().mockResolvedValue(failure(429));
      globalThis.fetch = fetchMock;

      await expect(callMentorModel(mentorInput)).rejects.toThrow(GeminiRateLimitError);
      expect(usedGeminiKeys(fetchMock)).toEqual(['shared-1', 'shared-2']);
    });

    it('does not try another key on timeout', async () => {
      env.GEMINI_API_KEY_2 = 'shared-2';
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      const fetchMock = vi.fn().mockRejectedValue(abortError);
      globalThis.fetch = fetchMock;

      await expect(callMentorModel(mentorInput)).rejects.toThrow(GeminiTimeoutError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('never sends the ticket keys for mentor requests', async () => {
      env.GEMINI_TICKET_API_KEY = 'ticket-1';
      const fetchMock = vi.fn().mockResolvedValue(geminiText('Hint.'));
      globalThis.fetch = fetchMock;

      await callMentorModel(mentorInput);
      expect(usedGeminiKeys(fetchMock)).toEqual(['shared-1']);
    });
  });

  describe('Gemini ticket generation', () => {
    const generated = JSON.stringify({
      title: 'Stale closure',
      scenario: 'A hook captures old state.',
      acceptanceCriteria: ['Fixed'],
      testChecklist: ['Verified'],
    });

    it('uses the ticket keys, separate from the mentor keys, with fallback', async () => {
      env.GEMINI_MENTOR_API_KEY = 'mentor-1';
      env.GEMINI_TICKET_API_KEY = 'ticket-1';
      env.GEMINI_TICKET_API_KEY_2 = 'ticket-2';
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(failure(429))
        .mockResolvedValueOnce(geminiText(generated));
      globalThis.fetch = fetchMock;

      const result = await callTicketGenerationModel(template, { userId: 'u1', starterTemplate: 'react' });
      expect(result.title).toBe('Stale closure');
      expect(usedGeminiKeys(fetchMock)).toEqual(['ticket-1', 'ticket-2']);
    });
  });

  describe('Groq evaluator', () => {
    it('falls back to the second Groq key on rate limit', async () => {
      env.GROQ_API_KEY_2 = 'groq-2';
      const fetchMock = vi.fn().mockResolvedValueOnce(failure(429)).mockResolvedValueOnce(groqFeedback());
      globalThis.fetch = fetchMock;

      await expect(callEvaluatorModel(evaluationInput)).resolves.toEqual({ feedback: 'Looks fine', scores: null });
      expect(usedGroqKeys(fetchMock)).toEqual(['groq-1', 'groq-2']);
    });

    it('falls back on a rejected key (non-2xx outage)', async () => {
      env.GROQ_API_KEY_2 = 'groq-2';
      const fetchMock = vi.fn().mockResolvedValueOnce(failure(401)).mockResolvedValueOnce(groqFeedback());
      globalThis.fetch = fetchMock;

      await callEvaluatorModel(evaluationInput);
      expect(usedGroqKeys(fetchMock)).toEqual(['groq-1', 'groq-2']);
    });

    it('throws the last error when both keys fail', async () => {
      env.GROQ_API_KEY_2 = 'groq-2';
      globalThis.fetch = vi.fn().mockResolvedValueOnce(failure(429)).mockResolvedValueOnce(failure(503));

      await expect(callEvaluatorModel(evaluationInput)).rejects.toThrow(GroqOutageError);
    });

    it('keeps single-key behaviour when no second key is set', async () => {
      const fetchMock = vi.fn().mockResolvedValue(failure(429));
      globalThis.fetch = fetchMock;

      await expect(callEvaluatorModel(evaluationInput)).rejects.toThrow(GroqRateLimitError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
