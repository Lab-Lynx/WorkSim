import type { TicketTemplate } from '../../types/domain.js';

export const nodeAddRouteTemplate: TicketTemplate = {
  key: 'node-add-route',
  category: 'backend',
  difficulty: 'beginner',
  touchedFiles: [
    'src/routes/index.ts',
    'src/routes/notes.routes.ts',
    'src/controllers/notes.controller.ts',
  ],
  acceptanceCriteriaStructure: [
    'Define the endpoint path in the Express router',
    'Implement the controller handler returning a structured JSON response',
  ],
  testChecklistStructure: [
    'Route returns 200 with expected response payload',
    'Route handles missing parameters with appropriate HTTP status',
  ],
};
