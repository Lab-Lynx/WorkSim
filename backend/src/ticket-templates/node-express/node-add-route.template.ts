import type { TicketTemplate } from '../../types/domain.js';

export const nodeAddRouteTemplate: TicketTemplate = {
  key: 'node-add-route',
  category: 'backend',
  difficulty: 'beginner',
  touchedFiles: ['src/routes/index.ts', 'src/controllers/health.controller.ts'],
  acceptanceCriteriaStructure: ['Expose a health route', 'Return a JSON envelope'],
  testChecklistStructure: ['Route returns 200', 'Body matches the envelope'],
};
