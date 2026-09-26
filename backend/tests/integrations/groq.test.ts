import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EvaluationInput,
  EvaluatorCategoryScores,
  MentorTranscriptMessage,
  TicketContent,
} from '../../src/types/domain.js';
import logger from '../../src/utils/logger.js';
import {
  callEvaluatorModel,
  GroqMalformedResponseError,
  GroqOutageError,
  GroqProviderError,
  GroqRateLimitError,
  GroqTimeoutError,
} from '../../src/integrations/groq.js';

describe('Groq Integration Adapter (Doc 8 §8.10, Doc 9 §9.2.10)', () => {
  const sentinelApiKey = 'sentinel-groq-key-xyz-12345';
  const sensitiveUserDiff = 'diff --git a/src/App.tsx b/src/App.tsx\n+ const secret = "USER_SECRET_TOKEN_XYZ";';

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
    { role: 'user', content: 'How do I fix the stale closure in my hook?' },
    { role: 'mentor', content: 'Look at the values referenced inside useEffect.' },
  ];

  const mockAttempt1Input: EvaluationInput = {
    attempt: 1,
    ticketContent: mockTicketContent,
    diff: sensitiveUserDiff,
    ciPassed: true,
  };

  const mockAttempt2Input: EvaluationInput = {
    attempt: 2,
    ticketContent: mockTicketContent,
    diff: sensitiveUserDiff,
    ciPassed: true,
    transcript: mockTranscript,
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

  describe('Groq — request contents (Doc 9 §9.2.10)', () => {
    it('includes diff, CI result, ticket content, attempt number, and config key in headers', async () => {
      let interceptedUrl = '';
      let interceptedHeaders: Record<string, string> = {};
      let interceptedBody: Record<string, unknown> | null = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        interceptedUrl = url;
        interceptedHeaders = (init?.headers as Record<string, string>) || {};
        interceptedBody = init?.body ? JSON.parse(init.body as string) : null;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    feedback: 'Great initial progress. Remember to clean up side effects.',
                    scores: null,
                  }),
                },
              },
            ],
          }),
        } as unknown as Response;
      });

      const result = await callEvaluatorModel(mockAttempt1Input);

      expect(interceptedUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(interceptedHeaders['Authorization']).toMatch(/^Bearer\s+/);
      expect(interceptedHeaders['Content-Type']).toBe('application/json');

      expect(interceptedBody?.model).toBeTruthy();
      expect(interceptedBody?.response_format).toEqual({ type: 'json_object' });

      const messages = (interceptedBody?.messages || []) as Array<{ role: string; content: string }>;
      const userMessage = messages.find((m) => m.role === 'user')?.content || '';
      expect(userMessage).toContain(mockAttempt1Input.ticketContent.title);
      expect(userMessage).toContain(mockAttempt1Input.diff);
      expect(userMessage).toContain('PASSED');
      expect(userMessage).toContain('Attempt 1');

      expect(result.feedback).toBe('Great initial progress. Remember to clean up side effects.');
      expect(result.scores).toBeNull();
    });

    it('includes mentor transcript on attempt 2 when provided', async () => {
      let interceptedBody: Record<string, unknown> | null = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        interceptedBody = init?.body ? JSON.parse(init.body as string) : null;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    feedback: 'Excellent final submission. Problem-solving was methodical.',
                    scores: {
                      requirementsMet: 90,
                      correctnessTests: 95,
                      codeQuality: 85,
                      problemSolving: 80,
                    },
                  }),
                },
              },
            ],
          }),
        } as unknown as Response;
      });

      const result = await callEvaluatorModel(mockAttempt2Input);

      const messages = (interceptedBody?.messages || []) as Array<{ role: string; content: string }>;
      const messagesText = JSON.stringify(messages);
      expect(messagesText).toContain('Attempt 2');
      expect(messagesText).toContain(mockTranscript[0].content);
      expect(messagesText).toContain(mockTranscript[1].content);

      expect(result.feedback).toBe('Excellent final submission. Problem-solving was methodical.');
      expect(result.scores).toEqual({
        requirementsMet: 90,
        correctnessTests: 95,
        codeQuality: 85,
        problemSolving: 80,
      });
    });

    it('handles ciPassed=false in request contents', async () => {
      let interceptedBody: Record<string, unknown> | null = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        interceptedBody = init?.body ? JSON.parse(init.body as string) : null;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    feedback: 'CI tests failed. Check the test suite assertions.',
                    scores: null,
                  }),
                },
              },
            ],
          }),
        } as unknown as Response;
      });

      await callEvaluatorModel({
        ...mockAttempt1Input,
        ciPassed: false,
      });

      const messagesText = JSON.stringify(interceptedBody.messages);
      expect(messagesText).toContain('FAILED');
    });
  });

  describe('Groq — valid output (Doc 9 §9.2.10)', () => {
    it('returns parsed EvaluatorOutput with scores null on attempt 1 even if model omitted scores', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  feedback: 'Good start. Fix the missing dependency in useEffect.',
                }),
              },
            },
          ],
        }),
      } as unknown as Response);

      const output = await callEvaluatorModel(mockAttempt1Input);
      expect(output.feedback).toBe('Good start. Fix the missing dependency in useEffect.');
      expect(output.scores).toBeNull();
    });

    it('returns parsed EvaluatorOutput with scores null on attempt 1 when model returns null scores', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  feedback: 'First attempt feedback only.',
                  scores: null,
                }),
              },
            },
          ],
        }),
      } as unknown as Response);

      const output = await callEvaluatorModel(mockAttempt1Input);
      expect(output.feedback).toBe('First attempt feedback only.');
      expect(output.scores).toBeNull();
    });

    it('normalizes attempt 1 scores to null if model sends scores on attempt 1', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  feedback: 'Attempt 1 feedback.',
                  scores: {
                    requirementsMet: 80,
                    correctnessTests: 80,
                    codeQuality: 80,
                    problemSolving: 80,
                  },
                }),
              },
            },
          ],
        }),
      } as unknown as Response);

      const output = await callEvaluatorModel(mockAttempt1Input);
      expect(output.feedback).toBe('Attempt 1 feedback.');
      expect(output.scores).toBeNull();
    });

    it('returns parsed EvaluatorOutput with all 4 scores on attempt 2', async () => {
      const validScores: EvaluatorCategoryScores = {
        requirementsMet: 85,
        correctnessTests: 90,
        codeQuality: 75.5,
        problemSolving: 80,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  feedback: 'Solid final implementation and clean code.',
                  scores: validScores,
                }),
              },
            },
          ],
        }),
      } as unknown as Response);

      const output = await callEvaluatorModel(mockAttempt2Input);
      expect(output.feedback).toBe('Solid final implementation and clean code.');
      expect(output.scores).toEqual(validScores);
    });

    it('strips markdown code block formatting around JSON output', async () => {
      const validScores: EvaluatorCategoryScores = {
        requirementsMet: 100,
        correctnessTests: 100,
        codeQuality: 95,
        problemSolving: 90,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: `\`\`\`json\n${JSON.stringify({
                  feedback: 'Wrapped in markdown code block.',
                  scores: validScores,
                })}\n\`\`\``,
              },
            },
          ],
        }),
      } as unknown as Response);

      const output = await callEvaluatorModel(mockAttempt2Input);
      expect(output.feedback).toBe('Wrapped in markdown code block.');
      expect(output.scores).toEqual(validScores);
    });
  });

  describe('Groq — invalid JSON & malformed response (Doc 9 §9.2.10, Doc 8 §8.19)', () => {
    it('throws GroqMalformedResponseError when provider returns prose instead of JSON', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Here is some prose instead of valid JSON evaluation.',
              },
            },
          ],
        }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toThrow(GroqMalformedResponseError);
      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toMatchObject({
        causeType: 'malformed_response',
        statusCode: 502,
      });
    });

    it('throws GroqMalformedResponseError when feedback is missing or empty', async () => {
      // Missing feedback key
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({ scores: null }),
              },
            },
          ],
        }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toThrow(GroqMalformedResponseError);

      // Empty string feedback
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({ feedback: '   ', scores: null }),
              },
            },
          ],
        }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toThrow(GroqMalformedResponseError);
    });

    it('throws GroqMalformedResponseError on attempt 2 when scores object is missing or null', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  feedback: 'Missing scores on attempt 2.',
                  scores: null,
                }),
              },
            },
          ],
        }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt2Input)).rejects.toThrow(GroqMalformedResponseError);
    });

    it('throws GroqMalformedResponseError on attempt 2 when a category score is missing', async () => {
      // Missing codeQuality
      const incompleteScores = {
        requirementsMet: 80,
        correctnessTests: 90,
        problemSolving: 70,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  feedback: 'Incomplete scores.',
                  scores: incompleteScores,
                }),
              },
            },
          ],
        }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt2Input)).rejects.toThrow(GroqMalformedResponseError);
    });

    it('throws GroqMalformedResponseError on attempt 2 when a score is out of range (< 0 or > 100)', async () => {
      // Score > 100
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  feedback: 'Score too high.',
                  scores: {
                    requirementsMet: 150,
                    correctnessTests: 80,
                    codeQuality: 80,
                    problemSolving: 80,
                  },
                }),
              },
            },
          ],
        }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt2Input)).rejects.toThrow(GroqMalformedResponseError);

      // Score < 0
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  feedback: 'Score negative.',
                  scores: {
                    requirementsMet: -5,
                    correctnessTests: 80,
                    codeQuality: 80,
                    problemSolving: 80,
                  },
                }),
              },
            },
          ],
        }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt2Input)).rejects.toThrow(GroqMalformedResponseError);
    });

    it('throws GroqMalformedResponseError on attempt 2 when a score is not a finite number', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  feedback: 'Score is string.',
                  scores: {
                    requirementsMet: 'eighty',
                    correctnessTests: 80,
                    codeQuality: 80,
                    problemSolving: 80,
                  },
                }),
              },
            },
          ],
        }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt2Input)).rejects.toThrow(GroqMalformedResponseError);
    });

    it('throws GroqMalformedResponseError when choices array is empty or message content is missing', async () => {
      // Empty choices
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [] }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toThrow(GroqMalformedResponseError);

      // Missing message content
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: {} }] }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toThrow(GroqMalformedResponseError);
    });

    it('throws GroqMalformedResponseError when response JSON parsing fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token in JSON');
        },
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toThrow(GroqMalformedResponseError);
    });
  });

  describe('Groq — timeout, rate limit, outage (Doc 9 §9.2.10)', () => {
    it('throws normalized GroqTimeoutError on timeout/abort', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toThrow(GroqTimeoutError);
      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toMatchObject({
        causeType: 'timeout',
        statusCode: 502,
      });
    });

    it('throws normalized GroqRateLimitError on HTTP 429', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { message: 'Rate limit reached', type: 'tokens' } }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toThrow(GroqRateLimitError);
      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toMatchObject({
        causeType: 'rate_limit',
        statusCode: 502,
      });
    });

    it('throws normalized GroqTimeoutError on HTTP 408', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 408,
        statusText: 'Request Timeout',
        json: async () => ({ error: { message: 'Request timed out' } }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toThrow(GroqTimeoutError);
      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toMatchObject({
        causeType: 'timeout',
        statusCode: 502,
      });
    });

    it('throws normalized GroqOutageError on HTTP 500 / 503', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ error: { message: 'Groq service temporarily unavailable' } }),
      } as unknown as Response);

      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toThrow(GroqOutageError);
      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toMatchObject({
        causeType: 'outage',
        statusCode: 502,
      });
    });

    it('throws normalized GroqOutageError on network failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toThrow(GroqOutageError);
      await expect(callEvaluatorModel(mockAttempt1Input)).rejects.toMatchObject({
        causeType: 'outage',
        statusCode: 502,
      });
    });
  });

  describe('Groq — key and sensitive data not leaked (Doc 9 §9.2.10, Doc 8 §8.19)', () => {
    it('does not leak API key or sensitive user code in thrown error or logs', async () => {
      const errorLoggerSpy = vi.spyOn(logger, 'error');
      const warnLoggerSpy = vi.spyOn(logger, 'warn');
      const infoLoggerSpy = vi.spyOn(logger, 'info');
      const debugLoggerSpy = vi.spyOn(logger, 'debug');

      const leakyProviderError = new Error(
        `Failed Groq call with key=${sentinelApiKey} and payload ${sensitiveUserDiff}`,
      );

      globalThis.fetch = vi.fn().mockRejectedValue(leakyProviderError);

      let caughtError: unknown;
      try {
        await callEvaluatorModel(mockAttempt1Input);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(GroqProviderError);
      const errorMessage = (caughtError as Error).message;
      const errorStack = (caughtError as Error).stack || '';

      expect(errorMessage).not.toContain(sentinelApiKey);
      expect(errorMessage).not.toContain(sensitiveUserDiff);
      expect(errorStack).not.toContain(sentinelApiKey);
      expect(errorStack).not.toContain(sensitiveUserDiff);

      const allLogCalls = [
        ...errorLoggerSpy.mock.calls,
        ...warnLoggerSpy.mock.calls,
        ...infoLoggerSpy.mock.calls,
        ...debugLoggerSpy.mock.calls,
      ];

      for (const call of allLogCalls) {
        const logContent = JSON.stringify(call);
        expect(logContent).not.toContain(sentinelApiKey);
        expect(logContent).not.toContain(sensitiveUserDiff);
      }
    });
  });
});
