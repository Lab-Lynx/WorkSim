import type { TicketContent, TicketTemplate } from '../types/domain.js';

/**
 * Gemini adapter for ticket-content fill (Doc 8 / D-06).
 * Mock this module in tests. Default builds valid TicketContent from the
 * template structure so local flows work without a live Gemini call.
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
