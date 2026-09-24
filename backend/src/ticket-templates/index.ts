import { z } from 'zod';
import type { TicketTemplate } from '../types/domain.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import { reactAddButtonTemplate } from './react/react-add-button.template.js';
import { nodeAddRouteTemplate } from './node-express/node-add-route.template.js';
import { djangoAddModelTemplate } from './django/django-add-model.template.js';

export type { TicketTemplate };

/**
 * Zod schema defining the team-authored ticket template shape (Doc 7 §7.2.8; Doc 8 §8.7).
 *
 * Fixed structure:
 * - key: stable key matching Ticket.templateKey in DB
 * - category: functional category (e.g. 'frontend', 'backend')
 * - difficulty: difficulty level (e.g. 'beginner', 'intermediate', 'advanced')
 * - touchedFiles: array of relative file paths the ticket will touch
 * - acceptanceCriteriaStructure: skeleton structure for acceptance criteria
 * - testChecklistStructure: skeleton structure for test checklist
 *
 * Note on persistence (Doc 7 §7.2.8):
 * The database stores only the stable template key in Ticket.templateKey.
 * The generated snapshot filled by Gemini lives in Ticket.content.
 */
export const ticketTemplateSchema = z.object({
  key: z.string().trim().min(1, 'Template key is required'),
  category: z.string().trim().min(1, 'Category is required'),
  difficulty: z.string().trim().min(1, 'Difficulty is required'),
  touchedFiles: z
    .array(z.string().trim().min(1, 'Touched file path cannot be empty'))
    .min(1, 'touchedFiles must contain at least one path'),
  acceptanceCriteriaStructure: z
    .array(z.string().trim().min(1, 'Acceptance criteria item cannot be empty'))
    .min(1, 'acceptanceCriteriaStructure must contain at least one item'),
  testChecklistStructure: z
    .array(z.string().trim().min(1, 'Test checklist item cannot be empty'))
    .min(1, 'testChecklistStructure must contain at least one item'),
});

/**
 * Shipped ticket templates for supported starter templates (React, Node/Express, Django; D-05).
 */
export const SHIPPED_TICKET_TEMPLATES: readonly TicketTemplate[] = Object.freeze([
  reactAddButtonTemplate,
  nodeAddRouteTemplate,
  djangoAddModelTemplate,
]);

/**
 * Validates a list of templates, verifies uniqueness of keys, and builds a lookup map.
 * Fails loudly with an internal configuration error if duplicate keys or malformed templates exist.
 */
export function buildTicketTemplateRegistry(
  templates: readonly unknown[],
): Map<string, TicketTemplate> {
  const registry = new Map<string, TicketTemplate>();

  for (const raw of templates) {
    const parseResult = ticketTemplateSchema.safeParse(raw);
    if (!parseResult.success) {
      const issueDetails = parseResult.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ');
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        `Malformed ticket template configuration: ${issueDetails}`,
      );
    }

    const template = parseResult.data;
    if (registry.has(template.key)) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        `Duplicate ticket template key in registry: ${template.key}`,
      );
    }

    registry.set(template.key, template);
  }

  return registry;
}

// Built at module evaluation / startup — duplicate keys or malformed templates throw immediately.
const templateRegistry: Map<string, TicketTemplate> = buildTicketTemplateRegistry(
  SHIPPED_TICKET_TEMPLATES,
);

/**
 * Export a lookup by key; unknown keys fail loudly with 500 (Doc 8 §8.7).
 * Never returns null or undefined.
 */
export const getTicketTemplate = (templateKey: string): TicketTemplate => {
  if (!templateKey || typeof templateKey !== 'string') {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      `Invalid or missing templateKey: ${String(templateKey)}`,
    );
  }

  const template = templateRegistry.get(templateKey);
  if (!template) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      `Unknown ticket template: ${templateKey}`,
    );
  }

  return template;
};

/**
 * Alias matching Doc 8 §8.7 signature `loadTicketTemplate(templateKey: string): TicketTemplate`.
 */
export const loadTicketTemplate = getTicketTemplate;

/**
 * Returns all registered templates as an array.
 */
export const getAllTicketTemplates = (): TicketTemplate[] => {
  return Array.from(templateRegistry.values());
};

/**
 * Checks whether a template key exists in the registry.
 */
export const hasTicketTemplate = (templateKey: string): boolean => {
  if (!templateKey || typeof templateKey !== 'string') {
    return false;
  }
  return templateRegistry.has(templateKey);
};
