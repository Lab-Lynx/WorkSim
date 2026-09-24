import type {
  TicketContent,
  TicketGenerationContext,
  TicketTemplate,
  TicketTemplateSelection,
} from '../types/domain.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import * as gemini from '../integrations/gemini.js';

const TEMPLATES: TicketTemplate[] = [
  {
    key: 'react-add-button',
    category: 'frontend',
    difficulty: 'beginner',
    touchedFiles: ['src/App.tsx', 'src/components/Button.tsx'],
    acceptanceCriteriaStructure: ['Add a reusable button', 'Wire it into the page'],
    testChecklistStructure: ['Unit test the button', 'Smoke-test the page'],
  },
  {
    key: 'node-add-route',
    category: 'backend',
    difficulty: 'beginner',
    touchedFiles: ['src/routes/index.ts', 'src/controllers/health.controller.ts'],
    acceptanceCriteriaStructure: ['Expose a health route', 'Return a JSON envelope'],
    testChecklistStructure: ['Route returns 200', 'Body matches the envelope'],
  },
];

const byKey = new Map(TEMPLATES.map((t) => [t.key, t]));

/** Load a team-authored template; unknown keys fail loudly (Doc 8). */
export const loadTicketTemplate = (templateKey: string): TicketTemplate => {
  const template = byKey.get(templateKey);
  if (!template) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, `Unknown ticket template: ${templateKey}`);
  }
  return template;
};

/**
 * Q-09 selection is unsettled — keep strategy isolated.
 * Default: first registry entry (deterministic, swappable in tests via mock).
 */
export const selectNextTicketTemplate = async (
  userId: string,
): Promise<TicketTemplateSelection> => {
  void userId;
  const first = TEMPLATES[0];
  if (!first) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'No ticket templates configured');
  }
  return { templateKey: first.key };
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const validateTicketContent = (
  content: TicketContent,
  template: TicketTemplate,
): TicketContent => {
  const required: (keyof TicketContent)[] = [
    'title',
    'scenario',
    'category',
    'difficulty',
    'touchedFiles',
    'acceptanceCriteria',
    'testChecklist',
  ];

  for (const key of required) {
    if (content[key] === undefined || content[key] === null) {
      throw new ApiError(
        HTTP_STATUS.BAD_GATEWAY,
        'Could not generate a ticket, please try again',
      );
    }
  }

  if (
    typeof content.title !== 'string' ||
    typeof content.scenario !== 'string' ||
    typeof content.category !== 'string' ||
    typeof content.difficulty !== 'string' ||
    !isStringArray(content.touchedFiles) ||
    !isStringArray(content.acceptanceCriteria) ||
    !isStringArray(content.testChecklist)
  ) {
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not generate a ticket, please try again',
    );
  }

  // Fixed structure fields must match the template (Doc 8 / FR-31).
  if (
    content.category !== template.category ||
    content.difficulty !== template.difficulty ||
    content.touchedFiles.length !== template.touchedFiles.length ||
    content.touchedFiles.some((f, i) => f !== template.touchedFiles[i])
  ) {
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not generate a ticket, please try again',
    );
  }

  return {
    title: content.title,
    scenario: content.scenario,
    category: content.category,
    difficulty: content.difficulty,
    touchedFiles: [...content.touchedFiles],
    acceptanceCriteria: [...content.acceptanceCriteria],
    testChecklist: [...content.testChecklist],
  };
};

export const generateTicketContent = async (
  template: TicketTemplate,
  context: TicketGenerationContext,
): Promise<TicketContent> => {
  void context;
  try {
    const raw = await gemini.generateTicketWording(template);
    return validateTicketContent(raw, template);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not generate a ticket, please try again',
    );
  }
};
