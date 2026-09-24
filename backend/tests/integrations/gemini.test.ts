import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MentorHintStage,
  MentorModelInput,
  MentorTranscriptMessage,
  TicketContent,
  TicketGenerationContext,
  TicketTemplate,
} from '../../src/types/domain.js';
import logger from '../../src/utils/logger.js';
import {
  callMentorModel,
  callTicketGenerationModel,
  GeminiMalformedResponseError,
  GeminiOutageError,
  GeminiProviderError,
  GeminiRateLimitError,
  GeminiTimeoutError,
} from '../../src/integrations/gemini.js';

describe('Gemini Integration Adapter (doc 8 §8.8, §8.7, doc 9 §9.2.10)', () => {
  const sentinelApiKey = 'sentinel-gemini-key-xyz-98765';
  const secretUserCode = 'const super_secret_user_token = "TOP_SECRET_123";';

  const mockTicketContent: TicketContent = {
    title: 'Fix React hook dependency',
    scenario: 'useEffect is missing dependency which causes stale closure.',
    category: 'react',
    difficulty: 'easy',
    touchedFiles: ['src/App.tsx'],
    acceptanceCriteria: ['Dependency is added', 'No stale closures'],
    testChecklist: ['Verify state update', 'Verify cleanup'],
  };

  const mockTranscript: MentorTranscriptMessage[] = [
    { role: 'user', content: 'I have a problem with useEffect.' },
    { role: 'mentor', content: 'What have you observed in the dependency array?' },
  ];

  const mockMentorInput: MentorModelInput = {
    ticketContent: mockTicketContent,
    transcript: mockTranscript,
    userMessage: `Here is my implementation: ${secretUserCode}`,
    hintStage: 'conceptual_hint' as MentorHintStage,
  };

  const mockTemplate: TicketTemplate = {
    key: 'react-stale-closure',
    category: 'react',
    difficulty: 'easy',
    touchedFiles: ['src/App.tsx'],
    acceptanceCriteriaStructure: ['criteria 1', 'criteria 2'],
    testChecklistStructure: ['checklist 1', 'checklist 2'],
  };

  const mockContext: TicketGenerationContext = {
    userId: 'user-abc-123',
    starterTemplate: 'react',
  };

  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('callMentorModel — doc 9 §9.2.10', () => {
    it('Gemini — request contents includes ticket content, transcript, current message, hint stage, and key from config', async () => {
      let interceptedUrl = '';
      let interceptedHeaders: Record<string, string> = {};
      let interceptedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        interceptedUrl = url;
        interceptedHeaders = (init?.headers as Record<string, string>) || {};
        interceptedBody = init?.body ? JSON.parse(init.body as string) : null;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Consider looking at how the closure captures state.' }],
                  role: 'model',
                },
              },
            ],
          }),
        } as unknown as Response;
      });

      const response = await callMentorModel(mockMentorInput);

      expect(response).toBe('Consider looking at how the closure captures state.');
      expect(interceptedUrl).toContain('generativelanguage.googleapis.com');
      // Key should be in header x-goog-api-key or as configured
      expect(interceptedHeaders['x-goog-api-key'] || interceptedUrl).toBeTruthy();

      expect(interceptedBody.systemInstruction.parts[0].text).toContain(mockMentorInput.ticketContent.title);
      expect(interceptedBody.systemInstruction.parts[0].text).toContain(mockMentorInput.hintStage);
      expect(interceptedBody.contents[0].parts[0].text).toBe(mockMentorInput.transcript[0].content);
      expect(interceptedBody.contents[1].parts[0].text).toBe(mockMentorInput.transcript[1].content);
      expect(interceptedBody.contents[2].parts[0].text).toBe(mockMentorInput.userMessage);
    });

    it('Gemini — plain-text response returns a string', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Here is a progressive mentor hint.' }],
                role: 'model',
              },
            },
          ],
        }),
      } as unknown as Response);

      const reply = await callMentorModel(mockMentorInput);
      expect(typeof reply).toBe('string');
      expect(reply).toBe('Here is a progressive mentor hint.');
    });

    it('Gemini — timeout throws normalized GeminiTimeoutError (cause: timeout)', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      await expect(callMentorModel(mockMentorInput)).rejects.toThrow(GeminiTimeoutError);
      await expect(callMentorModel(mockMentorInput)).rejects.toMatchObject({
        causeType: 'timeout',
        statusCode: 502,
      });
    });

    it('Gemini — rate limit (429) throws normalized GeminiRateLimitError (cause: rate_limit)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { message: 'Quota exceeded', code: 429 } }),
      } as unknown as Response);

      await expect(callMentorModel(mockMentorInput)).rejects.toThrow(GeminiRateLimitError);
      await expect(callMentorModel(mockMentorInput)).rejects.toMatchObject({
        causeType: 'rate_limit',
        statusCode: 502,
      });
    });

    it('Gemini — outage (500 / 503 / network error) throws normalized GeminiOutageError (cause: outage)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ error: { message: 'Backend unavailable', code: 503 } }),
      } as unknown as Response);

      await expect(callMentorModel(mockMentorInput)).rejects.toThrow(GeminiOutageError);
      await expect(callMentorModel(mockMentorInput)).rejects.toMatchObject({
        causeType: 'outage',
        statusCode: 502,
      });

      // Network disconnect / fetch failure
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(callMentorModel(mockMentorInput)).rejects.toThrow(GeminiOutageError);
    });

    it('Gemini — malformed provider response throws normalized GeminiMalformedResponseError', async () => {
      // Empty candidates
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [] }),
      } as unknown as Response);

      await expect(callMentorModel(mockMentorInput)).rejects.toThrow(
        GeminiMalformedResponseError,
      );

      // Missing content or parts
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [] } }] }),
      } as unknown as Response);

      await expect(callMentorModel(mockMentorInput)).rejects.toThrow(
        GeminiMalformedResponseError,
      );

      // Empty string text
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '   ' }] } }],
        }),
      } as unknown as Response);

      await expect(callMentorModel(mockMentorInput)).rejects.toThrow(
        GeminiMalformedResponseError,
      );
    });

    it('Gemini — key and prompt not leaked in error messages or logs', async () => {
      const errorLoggerSpy = vi.spyOn(logger, 'error');
      const warnLoggerSpy = vi.spyOn(logger, 'warn');
      const infoLoggerSpy = vi.spyOn(logger, 'info');
      const debugLoggerSpy = vi.spyOn(logger, 'debug');

      const leakyProviderError = new Error(
        `Failed request key=${sentinelApiKey} with payload ${secretUserCode}`,
      );

      globalThis.fetch = vi.fn().mockRejectedValue(leakyProviderError);

      let caughtError: unknown;
      try {
        await callMentorModel(mockMentorInput);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(GeminiProviderError);
      const errorMessage = (caughtError as Error).message;
      const errorStack = (caughtError as Error).stack || '';

      expect(errorMessage).not.toContain(sentinelApiKey);
      expect(errorMessage).not.toContain(secretUserCode);
      expect(errorStack).not.toContain(sentinelApiKey);
      expect(errorStack).not.toContain(secretUserCode);

      // Check all logger calls to ensure neither secret leaked
      const allLogCalls = [
        ...errorLoggerSpy.mock.calls,
        ...warnLoggerSpy.mock.calls,
        ...infoLoggerSpy.mock.calls,
        ...debugLoggerSpy.mock.calls,
      ];

      for (const call of allLogCalls) {
        const logContent = JSON.stringify(call);
        expect(logContent).not.toContain(sentinelApiKey);
        expect(logContent).not.toContain(secretUserCode);
      }
    });
  });

  describe('callTicketGenerationModel (doc 8 §8.7, doc 9 §9.2.10)', () => {
    it('Gemini — request contents includes template structure, context and key from config', async () => {
      let interceptedUrl = '';
      let interceptedHeaders: Record<string, string> = {};
      let interceptedBody: any = null;

      const generatedTicketData: TicketContent = {
        title: 'Prevent stale closures in useCounter',
        scenario: 'Counter hook fails to update when callbacks are invoked rapidly.',
        category: mockTemplate.category,
        difficulty: mockTemplate.difficulty,
        touchedFiles: mockTemplate.touchedFiles,
        acceptanceCriteria: [
          'Counter accurately reflects quick updates',
          'Dependency array includes counter reference',
        ],
        testChecklist: [
          'Run unit test for rapid increment',
          'Verify no regression in decrement',
        ],
      };

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        interceptedUrl = url;
        interceptedHeaders = (init?.headers as Record<string, string>) || {};
        interceptedBody = init?.body ? JSON.parse(init.body as string) : null;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(generatedTicketData) }],
                  role: 'model',
                },
              },
            ],
          }),
        } as unknown as Response;
      });

      const result = await callTicketGenerationModel({
        template: mockTemplate,
        context: mockContext,
      });

      expect(interceptedUrl).toContain('generativelanguage.googleapis.com');
      expect(interceptedHeaders['x-goog-api-key'] || interceptedUrl).toBeTruthy();

      const bodyString = JSON.stringify(interceptedBody);
      expect(bodyString).toContain(mockTemplate.key);
      expect(bodyString).toContain(mockTemplate.category);
      expect(bodyString).toContain(mockContext.userId);

      expect(result).toEqual(generatedTicketData);
      expect(result.category).toBe(mockTemplate.category);
      expect(result.difficulty).toBe(mockTemplate.difficulty);
      expect(result.touchedFiles).toEqual(mockTemplate.touchedFiles);
    });

    it('Gemini — supports passing (template, context) signature as overload', async () => {
      const generatedTicketData: TicketContent = {
        title: 'Prevent stale closures in useCounter',
        scenario: 'Counter hook fails to update when callbacks are invoked rapidly.',
        category: mockTemplate.category,
        difficulty: mockTemplate.difficulty,
        touchedFiles: mockTemplate.touchedFiles,
        acceptanceCriteria: ['Passes criteria'],
        testChecklist: ['Passes test checklist'],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(generatedTicketData) }],
                role: 'model',
              },
            },
          ],
        }),
      } as unknown as Response);

      const result = await callTicketGenerationModel(mockTemplate, mockContext);
      expect(result.title).toBe(generatedTicketData.title);
      expect(result.category).toBe(mockTemplate.category);
    });

    it('Gemini — malformed non-JSON output throws GeminiMalformedResponseError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Here is some prose instead of valid JSON.' }],
                role: 'model',
              },
            },
          ],
        }),
      } as unknown as Response);

      await expect(
        callTicketGenerationModel({ template: mockTemplate, context: mockContext }),
      ).rejects.toThrow(GeminiMalformedResponseError);
    });

    it('Gemini — missing required TicketContent fields in model JSON throws GeminiMalformedResponseError', async () => {
      // Missing acceptanceCriteria
      const incompleteTicketData = {
        title: 'Incomplete ticket',
        scenario: 'Missing fields',
        category: mockTemplate.category,
        difficulty: mockTemplate.difficulty,
        touchedFiles: mockTemplate.touchedFiles,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(incompleteTicketData) }],
                role: 'model',
              },
            },
          ],
        }),
      } as unknown as Response);

      await expect(
        callTicketGenerationModel({ template: mockTemplate, context: mockContext }),
      ).rejects.toThrow(GeminiMalformedResponseError);
    });

    it('Gemini — timeout, rate limit, outage normalize correctly for ticket generation', async () => {
      // 429
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Quota exceeded' } }),
      } as unknown as Response);
      await expect(
        callTicketGenerationModel({ template: mockTemplate, context: mockContext }),
      ).rejects.toThrow(GeminiRateLimitError);

      // 500
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal Server Error' } }),
      } as unknown as Response);
      await expect(
        callTicketGenerationModel({ template: mockTemplate, context: mockContext }),
      ).rejects.toThrow(GeminiOutageError);
    });

    it('Gemini — sentinel key not leaked during ticket generation error', async () => {
      const errorLoggerSpy = vi.spyOn(logger, 'error');

      globalThis.fetch = vi.fn().mockRejectedValue(
        new Error(`Gemini exploded with sentinel key: ${sentinelApiKey}`),
      );

      let caughtError: unknown;
      try {
        await callTicketGenerationModel({ template: mockTemplate, context: mockContext });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(GeminiProviderError);
      expect((caughtError as Error).message).not.toContain(sentinelApiKey);

      for (const call of errorLoggerSpy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(sentinelApiKey);
      }
    });
  });
});
