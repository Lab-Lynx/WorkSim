import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import type {
  EvaluationInput,
  EvaluatorCategoryScores,
  EvaluatorOutput,
} from '../types/domain.js';

export type GroqErrorCause = 'timeout' | 'rate_limit' | 'malformed_response' | 'outage';

export class GroqProviderError extends Error {
  readonly causeType: GroqErrorCause;
  readonly statusCode: number;

  constructor(causeType: GroqErrorCause, message: string, statusCode = 502) {
    super(message);
    this.name = 'GroqProviderError';
    this.causeType = causeType;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, GroqProviderError.prototype);
  }
}

export class GroqTimeoutError extends GroqProviderError {
  constructor(message = 'Groq request timed out') {
    super('timeout', message, 502);
    this.name = 'GroqTimeoutError';
    Object.setPrototypeOf(this, GroqTimeoutError.prototype);
  }
}

export class GroqRateLimitError extends GroqProviderError {
  constructor(message = 'Groq rate limit exceeded') {
    super('rate_limit', message, 502);
    this.name = 'GroqRateLimitError';
    Object.setPrototypeOf(this, GroqRateLimitError.prototype);
  }
}

export class GroqMalformedResponseError extends GroqProviderError {
  constructor(message = 'Malformed response from Groq') {
    super('malformed_response', message, 502);
    this.name = 'GroqMalformedResponseError';
    Object.setPrototypeOf(this, GroqMalformedResponseError.prototype);
  }
}

export class GroqOutageError extends GroqProviderError {
  constructor(message = 'Groq service unavailable') {
    super('outage', message, 502);
    this.name = 'GroqOutageError';
    Object.setPrototypeOf(this, GroqOutageError.prototype);
  }
}

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_TIMEOUT_MS = 15000;

interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqChatCompletionPayload {
  model: string;
  messages: GroqChatMessage[];
  response_format?: {
    type: 'json_object';
  };
  temperature?: number;
}

/**
 * Execute Groq Chat Completions API call with sanitized error handling and logging.
 * Never logs prompt contents or raw error objects containing API keys or user code.
 */
async function executeGroqRequest(messages: GroqChatMessage[]): Promise<string> {
  const apiKey = env.GROQ_API_KEY;
  const model = env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const timeoutMs =
    env.SUBMISSION_EVALUATOR_TIMEOUT_MS || env.AI_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS;

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const payload: GroqChatCompletionPayload = {
    model,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.2,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Request timed out'));
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const error = err as { name?: string; message?: string };

    if (
      error?.name === 'AbortError' ||
      error?.name === 'TimeoutError' ||
      error?.message?.toLowerCase().includes('time') ||
      controller.signal.aborted
    ) {
      logger.error({ cause: 'timeout' }, 'Groq evaluator provider call timed out');
      throw new GroqTimeoutError();
    }

    // Network error / DNS outage / unreachable
    logger.error({ cause: 'outage' }, 'Groq evaluator provider network request failed');
    throw new GroqOutageError();
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 429) {
      logger.error({ cause: 'rate_limit', statusCode: 429 }, 'Groq rate limit exceeded');
      throw new GroqRateLimitError();
    }

    if (response.status === 408) {
      logger.error({ cause: 'timeout', statusCode: 408 }, 'Groq request timed out');
      throw new GroqTimeoutError();
    }

    logger.error(
      { cause: 'outage', statusCode: response.status },
      'Groq provider returned non-2xx status',
    );
    throw new GroqOutageError();
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    logger.error({ cause: 'malformed_response' }, 'Failed to parse Groq response JSON');
    throw new GroqMalformedResponseError();
  }

  const responseObj = data as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  const messageContent = responseObj?.choices?.[0]?.message?.content;

  if (typeof messageContent !== 'string' || messageContent.trim().length === 0) {
    logger.error({ cause: 'malformed_response' }, 'Groq message content missing or empty');
    throw new GroqMalformedResponseError();
  }

  return messageContent.trim();
}

/**
 * Validate that a category score is a valid finite number within the rubric range [0, 100].
 */
function isValidCategoryScore(score: unknown): score is number {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
}

/**
 * Call Groq evaluator model (Doc 8 §8.10, Doc 9 §9.2.10).
 * Evaluates ticket submission diff alongside CI result and optional mentor transcript.
 * Output is parsed and structurally validated before returning (Doc 8 §8.19).
 */
export async function callEvaluatorModel(input: EvaluationInput): Promise<EvaluatorOutput> {
  const systemPrompt = [
    'You are an expert technical lead evaluating a software engineering simulation ticket submission.',
    'Evaluation Rubric:',
    '- Requirements Met (40% weight)',
    '- Correctness & Tests (25% weight)',
    '- Code Quality (20% weight)',
    '- Problem Solving & Communication Evidence (15% weight)',
    '',
    'Rules:',
    '1. Never judge the code diff in isolation; evaluate in context of the CI test outcome and ticket acceptance criteria (FR-43).',
    '2. Attempt 1 is an initial submission: Provide thorough, constructive feedback on how to fix issues and improve before attempt 2. Set scores to null.',
    '3. Attempt 2 is the final submission: Provide comprehensive review feedback and assign numerical scores (0-100) for all four categories: requirementsMet, correctnessTests, codeQuality, and problemSolving. Evaluate the mentor discussion transcript for problemSolving evidence.',
    '4. Output format must be a strictly valid JSON object matching:',
    '   Attempt 1: { "feedback": "<detailed constructive feedback string>", "scores": null }',
    '   Attempt 2: { "feedback": "<detailed final review string>", "scores": { "requirementsMet": <0-100>, "correctnessTests": <0-100>, "codeQuality": <0-100>, "problemSolving": <0-100> } }',
    '5. Do not include markdown code blocks or text outside the JSON object.',
  ].join('\n');

  const userPromptLines: string[] = [
    `Ticket Title: ${input.ticketContent.title}`,
    `Ticket Scenario: ${input.ticketContent.scenario}`,
    `Category: ${input.ticketContent.category}`,
    `Difficulty: ${input.ticketContent.difficulty}`,
    `Touched Files: ${input.ticketContent.touchedFiles.join(', ')}`,
    `Acceptance Criteria: ${input.ticketContent.acceptanceCriteria.join('; ')}`,
    `Test Checklist: ${input.ticketContent.testChecklist.join('; ')}`,
    '',
    `Submission Attempt: Attempt ${input.attempt}`,
    `CI Pipeline Status: ${input.ciPassed ? 'PASSED' : 'FAILED'}`,
    '',
    'Code Changes (Git Diff):',
    input.diff,
  ];

  if (input.transcript && input.transcript.length > 0) {
    userPromptLines.push(
      '',
      'Mentor Interaction Transcript:',
      ...input.transcript.map((msg) => `[${msg.role}]: ${msg.content}`),
    );
  }

  const messages: GroqChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPromptLines.join('\n') },
  ];

  const rawResponse = await executeGroqRequest(messages);

  let parsed: unknown;
  try {
    // Strip markdown code fences if model returned them
    const cleaned = rawResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    logger.error({ cause: 'malformed_response' }, 'Failed to parse Groq evaluator output JSON');
    throw new GroqMalformedResponseError();
  }

  // Structural validation (Doc 8 §8.19: output is untrusted input)
  if (!parsed || typeof parsed !== 'object') {
    logger.error(
      { cause: 'malformed_response' },
      'Groq evaluator output missing or not an object',
    );
    throw new GroqMalformedResponseError();
  }

  const record = parsed as Record<string, unknown>;

  if (typeof record.feedback !== 'string' || record.feedback.trim().length === 0) {
    logger.error(
      { cause: 'malformed_response' },
      'Groq evaluator output missing or empty feedback',
    );
    throw new GroqMalformedResponseError();
  }

  const feedback = record.feedback.trim();

  if (input.attempt === 1) {
    // Attempt 1 requires feedback only; scores are null (Doc 8 §8.10, Doc 9 §9.2.12)
    return {
      feedback,
      scores: null,
    };
  }

  // Attempt 2 requires valid scores for all 4 rubric categories
  const rawScores = record.scores;
  if (!rawScores || typeof rawScores !== 'object') {
    logger.error(
      { cause: 'malformed_response' },
      'Groq evaluator output missing scores object on attempt 2',
    );
    throw new GroqMalformedResponseError();
  }

  const scoresRecord = rawScores as Record<string, unknown>;
  const { requirementsMet, correctnessTests, codeQuality, problemSolving } = scoresRecord;

  if (
    !isValidCategoryScore(requirementsMet) ||
    !isValidCategoryScore(correctnessTests) ||
    !isValidCategoryScore(codeQuality) ||
    !isValidCategoryScore(problemSolving)
  ) {
    logger.error(
      { cause: 'malformed_response' },
      'Groq evaluator output has invalid or out-of-range category scores',
    );
    throw new GroqMalformedResponseError();
  }

  const validatedScores: EvaluatorCategoryScores = {
    requirementsMet,
    correctnessTests,
    codeQuality,
    problemSolving,
  };

  return {
    feedback,
    scores: validatedScores,
  };
}
