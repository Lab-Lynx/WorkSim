import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../src/config/env.js';
import { collectApiKeys } from '../../src/integrations/api-keys.js';
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
