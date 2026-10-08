import type {
  TicketContent,
  TicketGenerationContext,
  TicketTemplate,
  TicketTemplateSelection,
} from '../types/domain.js';
import { TicketStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import * as gemini from '../integrations/gemini.js';
import {
  loadTicketTemplate as lookupTemplate,
  getAllTicketTemplates,
} from '../ticket-templates/index.js';

export type TicketTemplateSelectionStrategy = (
  userId: string,
) => Promise<TicketTemplateSelection> | TicketTemplateSelection;

/** Load a team-authored template; unknown keys fail loudly (Doc 8). */
export const loadTicketTemplate = (templateKey: string): TicketTemplate => {
  return lookupTemplate(templateKey);
};

const STARTER_TEMPLATE_KEY_PREFIX: Record<string, string> = {
  react: 'react-',
  node_express: 'node-',
  django: 'django-',
};

/**
 * Default: only templates matching the user's starter repo stack, skipping ones already
 * completed. When every template for the stack is done, repeats the least recently completed.
 */
const defaultSelectionStrategy: TicketTemplateSelectionStrategy = async (
  userId: string,
): Promise<TicketTemplateSelection> => {
  const allTemplates = getAllTicketTemplates();
  if (allTemplates.length === 0) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'No ticket templates configured');
  }

  const repo = await prisma.starterRepo.findUnique({
    where: { userId },
    select: { starterTemplate: true },
  });
  const prefix = repo ? STARTER_TEMPLATE_KEY_PREFIX[repo.starterTemplate] : undefined;
  const stackTemplates = prefix
    ? allTemplates.filter((t) => t.key.startsWith(prefix))
    : allTemplates;
  const candidates = stackTemplates.length > 0 ? stackTemplates : allTemplates;

  const doneTickets = await prisma.ticket.findMany({
    where: { userId, status: TicketStatus.done },
    orderBy: { completedAt: 'desc' },
    select: { templateKey: true },
  });
  const doneKeys = doneTickets.map((t) => t.templateKey);

  const notDone = candidates.find((t) => !doneKeys.includes(t.key));
  if (notDone) {
    return { templateKey: notDone.key };
  }

  // All done: pick the one completed longest ago (highest index in the newest-first list).
  let oldest = candidates[0]!;
  let oldestIndex = -1;
  for (const candidate of candidates) {
    const index = doneKeys.indexOf(candidate.key);
    if (index > oldestIndex) {
      oldestIndex = index;
      oldest = candidate;
    }
  }
  return { templateKey: oldest.key };
};

let currentSelectionStrategy: TicketTemplateSelectionStrategy = defaultSelectionStrategy;

export const setTicketTemplateSelectionStrategy = (
  strategy: TicketTemplateSelectionStrategy,
): void => {
  currentSelectionStrategy = strategy;
};

export const resetTicketTemplateSelectionStrategy = (): void => {
  currentSelectionStrategy = defaultSelectionStrategy;
};

/**
 * Q-09 selection is unsettled — keep strategy isolated in one function.
 * Default: first registry entry (deterministic, swappable in tests or future strategy).
 */
export const selectNextTicketTemplate = async (
  userId: string,
): Promise<TicketTemplateSelection> => {
  return await currentSelectionStrategy(userId);
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const MAX_GENERATED_TITLE_CHARS = 240;
const MAX_GENERATED_SCENARIO_CHARS = 4_000;
const MAX_GENERATED_ITEM_CHARS = 1_000;
const MAX_GENERATED_ITEMS = 30;

const validateTicketContent = (
  content: unknown,
  template: TicketTemplate,
): TicketContent => {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not generate a ticket, please try again',
    );
  }

  const raw = content as Record<string, unknown>;

  const requiredFields = [
    'title',
    'scenario',
    'category',
    'difficulty',
    'touchedFiles',
    'acceptanceCriteria',
    'testChecklist',
  ] as const;

  for (const key of requiredFields) {
    if (raw[key] === undefined || raw[key] === null) {
      throw new ApiError(
        HTTP_STATUS.BAD_GATEWAY,
        'Could not generate a ticket, please try again',
      );
    }
  }

  if (
    typeof raw.title !== 'string' ||
    typeof raw.scenario !== 'string' ||
    typeof raw.category !== 'string' ||
    typeof raw.difficulty !== 'string' ||
    !isStringArray(raw.touchedFiles) ||
    !isStringArray(raw.acceptanceCriteria) ||
    !isStringArray(raw.testChecklist)
  ) {
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not generate a ticket, please try again',
    );
  }

  if (
    raw.title.length > MAX_GENERATED_TITLE_CHARS ||
    raw.scenario.length > MAX_GENERATED_SCENARIO_CHARS ||
    raw.acceptanceCriteria.length > MAX_GENERATED_ITEMS ||
    raw.testChecklist.length > MAX_GENERATED_ITEMS ||
    raw.acceptanceCriteria.some((item) => item.length > MAX_GENERATED_ITEM_CHARS) ||
    raw.testChecklist.some((item) => item.length > MAX_GENERATED_ITEM_CHARS)
  ) {
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not generate a ticket, please try again',
    );
  }

  // Fixed structure fields must match the template (Doc 8 / FR-31).
  if (
    raw.category !== template.category ||
    raw.difficulty !== template.difficulty ||
    raw.touchedFiles.length !== template.touchedFiles.length ||
    raw.touchedFiles.some((f, i) => f !== template.touchedFiles[i])
  ) {
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not generate a ticket, please try again',
    );
  }

  // Strip extra fields and return clean TicketContent
  return {
    title: raw.title,
    scenario: raw.scenario,
    category: template.category,
    difficulty: template.difficulty,
    touchedFiles: [...template.touchedFiles],
    acceptanceCriteria: [...raw.acceptanceCriteria],
    testChecklist: [...raw.testChecklist],
  };
};

export const generateTicketContent = async (
  template: TicketTemplate,
  context: TicketGenerationContext,
): Promise<TicketContent> => {
  try {
    const raw = await (gemini.generateTicketWording as (
      t: TicketTemplate,
      c?: TicketGenerationContext,
    ) => Promise<unknown>)(template, context);
    return validateTicketContent(raw, template);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not generate a ticket, please try again',
    );
  }
};
