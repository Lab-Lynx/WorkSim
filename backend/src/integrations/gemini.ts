import { env } from '../config/env.js';
import logger from '../utils/logger.js';
import type {
  MentorModelInput,
  TicketContent,
  TicketGenerationContext,
  TicketTemplate,
} from '../types/domain.js';

export type GeminiErrorCause = 'timeout' | 'rate_limit' | 'malformed_response' | 'outage';

export class GeminiProviderError extends Error {
  readonly causeType: GeminiErrorCause;
  readonly statusCode: number;

  constructor(causeType: GeminiErrorCause, message: string, statusCode = 502) {
    super(message);
    this.name = 'GeminiProviderError';
    this.causeType = causeType;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, GeminiProviderError.prototype);
  }
}

export class GeminiTimeoutError extends GeminiProviderError {
  constructor(message = 'Gemini request timed out') {
    super('timeout', message, 502);
    this.name = 'GeminiTimeoutError';
    Object.setPrototypeOf(this, GeminiTimeoutError.prototype);
  }
}

export class GeminiRateLimitError extends GeminiProviderError {
  constructor(message = 'Gemini rate limit exceeded') {
    super('rate_limit', message, 502);
    this.name = 'GeminiRateLimitError';
    Object.setPrototypeOf(this, GeminiRateLimitError.prototype);
  }
}

export class GeminiMalformedResponseError extends GeminiProviderError {
  constructor(message = 'Malformed response from Gemini') {
    super('malformed_response', message, 502);
    this.name = 'GeminiMalformedResponseError';
    Object.setPrototypeOf(this, GeminiMalformedResponseError.prototype);
  }
}

export class GeminiOutageError extends GeminiProviderError {
  constructor(message = 'Gemini service unavailable') {
    super('outage', message, 502);
    this.name = 'GeminiOutageError';
    Object.setPrototypeOf(this, GeminiOutageError.prototype);
  }
}

export interface TicketGenerationModelInput {
  template: TicketTemplate;
  context: TicketGenerationContext;
}

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
const DEFAULT_TIMEOUT_MS = 10000;

interface GeminiRequestPayload {
  contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    responseMimeType?: string;
  };
}

/**
 * Execute Gemini REST API call with sanitized error handling and logging.
 * Never logs prompt contents or raw error objects containing API keys or user code.
 */
async function executeGeminiRequest(payload: GeminiRequestPayload): Promise<string> {
  const apiKey = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const timeoutMs = env.AI_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

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
        'x-goog-api-key': apiKey,
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
      logger.error({ cause: 'timeout' }, 'Gemini provider call timed out');
      throw new GeminiTimeoutError();
    }

    // Network error / DNS outage / unreachable
    logger.error({ cause: 'outage' }, 'Gemini provider network request failed');
    throw new GeminiOutageError();
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 429) {
      logger.error({ cause: 'rate_limit', statusCode: 429 }, 'Gemini rate limit exceeded');
      throw new GeminiRateLimitError();
    }

    if (response.status === 408) {
      logger.error({ cause: 'timeout', statusCode: 408 }, 'Gemini request timed out');
      throw new GeminiTimeoutError();
    }

    logger.error({ cause: 'outage', statusCode: response.status }, 'Gemini provider returned non-2xx status');
    throw new GeminiOutageError();
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    logger.error({ cause: 'malformed_response' }, 'Failed to parse Gemini response JSON');
    throw new GeminiMalformedResponseError();
  }

  const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof candidateText !== 'string' || candidateText.trim().length === 0) {
    logger.error({ cause: 'malformed_response' }, 'Gemini candidate text missing or empty');
    throw new GeminiMalformedResponseError();
  }

  return candidateText.trim();
}

/**
 * Call Gemini mentor model (Doc 8 §8.8, Doc 9 §9.2.10).
 * Input includes ticket content, transcript, current user message, and progressive hint stage.
 * Returns plain-text mentor response.
 */
export async function callMentorModel(input: MentorModelInput): Promise<string> {
  const systemPrompt = [
    'You are an expert engineering mentor assisting a software engineer working on a ticket.',
    `Ticket Title: ${input.ticketContent.title}`,
    `Ticket Scenario: ${input.ticketContent.scenario}`,
    `Category: ${input.ticketContent.category}`,
    `Difficulty: ${input.ticketContent.difficulty}`,
    `Touched Files: ${input.ticketContent.touchedFiles.join(', ')}`,
    `Acceptance Criteria: ${input.ticketContent.acceptanceCriteria.join('; ')}`,
    `Test Checklist: ${input.ticketContent.testChecklist.join('; ')}`,
    `Current Progressive Hint Stage: ${input.hintStage}`,
    'Progressive hint stages follow FR-38: ask what was tried -> conceptual hint -> point to relevant file/function -> specific suggestion.',
    'Adhere strictly to the requested hint stage. Provide concise, constructive guidance without giving away the full solution prematurely.',
  ].join('\n');

  const contents: GeminiRequestPayload['contents'] = [];

  for (const msg of input.transcript) {
    contents.push({
      role: msg.role === 'mentor' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  // Include current user message
  contents.push({
    role: 'user',
    parts: [{ text: input.userMessage }],
  });

  const payload: GeminiRequestPayload = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
  };

  return executeGeminiRequest(payload);
}

/**
 * Call Gemini ticket content generation model (Doc 8 §8.7, Doc 9 §9.2.10).
 * Ask Gemini to fill specific wording/scenario inside the fixed team-authored template structure.
 * Supports both callTicketGenerationModel({ template, context }) and callTicketGenerationModel(template, context).
 */
export async function callTicketGenerationModel(
  input: TicketGenerationModelInput,
): Promise<TicketContent>;
export async function callTicketGenerationModel(
  template: TicketTemplate,
  context: TicketGenerationContext,
): Promise<TicketContent>;
export async function callTicketGenerationModel(
  inputOrTemplate: TicketGenerationModelInput | TicketTemplate,
  maybeContext?: TicketGenerationContext,
): Promise<TicketContent> {
  let template: TicketTemplate;
  let context: TicketGenerationContext;

  if ('template' in inputOrTemplate && 'context' in inputOrTemplate) {
    template = inputOrTemplate.template;
    context = inputOrTemplate.context;
  } else {
    template = inputOrTemplate;
    context = maybeContext as TicketGenerationContext;
  }

  const prompt = [
    'You are a technical lead creating a realistic software engineering simulation ticket.',
    'You must fill in the specific scenario, title, acceptance criteria, and test checklist wording within the fixed template structure.',
    `Template Key: ${template.key}`,
    `Category: ${template.category}`,
    `Difficulty: ${template.difficulty}`,
    `Touched Files: ${JSON.stringify(template.touchedFiles)}`,
    `Acceptance Criteria Structure: ${JSON.stringify(template.acceptanceCriteriaStructure)}`,
    `Test Checklist Structure: ${JSON.stringify(template.testChecklistStructure)}`,
    `Context User ID: ${context.userId}`,
    `Starter Template: ${context.starterTemplate}`,
    'Rules:',
    '1. Do not change category, difficulty, or touched files.',
    '2. Return a valid JSON object matching the TicketContent interface with keys: title, scenario, category, difficulty, touchedFiles, acceptanceCriteria, testChecklist.',
    '3. Output JSON only.',
  ].join('\n');

  const payload: GeminiRequestPayload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  };

  const rawResponse = await executeGeminiRequest(payload);

  let parsed: any;
  try {
    // Strip possible markdown code blocks ```json ... ``` if model returned them
    const cleaned = rawResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    logger.error({ cause: 'malformed_response' }, 'Failed to parse generated ticket JSON');
    throw new GeminiMalformedResponseError();
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof parsed.title !== 'string' ||
    !parsed.title.trim() ||
    typeof parsed.scenario !== 'string' ||
    !parsed.scenario.trim() ||
    !Array.isArray(parsed.acceptanceCriteria) ||
    parsed.acceptanceCriteria.length === 0 ||
    !Array.isArray(parsed.testChecklist) ||
    parsed.testChecklist.length === 0
  ) {
    logger.error({ cause: 'malformed_response' }, 'Generated ticket content missing required fields');
    throw new GeminiMalformedResponseError();
  }

  const result: TicketContent = {
    title: parsed.title.trim(),
    scenario: parsed.scenario.trim(),
    category: template.category,
    difficulty: template.difficulty,
    touchedFiles: [...template.touchedFiles],
    acceptanceCriteria: parsed.acceptanceCriteria.map((c: any) => String(c).trim()),
    testChecklist: parsed.testChecklist.map((t: any) => String(t).trim()),
  };

  return result;
}

/**
 * Ticket-lifecycle stub (Doc 8 / D-06).
 * Builds valid TicketContent from the template so local flows work without a live call.
 * Prefer callTicketGenerationModel when a real Gemini fill is required.
 */
export const generateTicketWording = async (
  template: TicketTemplate,
): Promise<TicketContent> => ({
  title: `${template.category}: ${template.key}`,
  scenario: `Implement the ${template.key} ticket for the ${template.difficulty} track.`,
  category: template.category,
  difficulty: template.difficulty,
  touchedFiles: [...template.touchedFiles],
  acceptanceCriteria: template.acceptanceCriteriaStructure.map(
    (item, i) => `${item} (criterion ${i + 1})`,
  ),
  testChecklist: template.testChecklistStructure.map(
    (item, i) => `${item} (check ${i + 1})`,
  ),
});
