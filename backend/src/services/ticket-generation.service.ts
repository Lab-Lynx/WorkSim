import type {
  TicketContent,
  TicketGenerationContext,
  TicketTemplate,
  TicketTemplateSelection,
} from '../types/domain.js';
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

const defaultSelectionStrategy: TicketTemplateSelectionStrategy = async (
  userId: string,
): Promise<TicketTemplateSelection> => {
  void userId;
  const templates = getAllTicketTemplates();
  const first = templates[0];
  if (!first) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'No ticket templates configured');
  }
  return { templateKey: first.key };
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
