import type { TicketTemplate } from '../../types/domain.js';

export const nodeServiceFeatureTemplate: TicketTemplate = {
  key: 'node-service-feature',
  category: 'backend',
  difficulty: 'advanced',
  touchedFiles: [
    'src/services/notes.service.ts',
    'src/controllers/notes.controller.ts',
    'src/routes/notes.routes.ts',
    'tests/notes.test.ts',
  ],
  acceptanceCriteriaStructure: [
    'Implement business logic and data querying methods in notes service',
    'Connect service logic to controller and expose via REST endpoint',
  ],
  testChecklistStructure: [
    'Unit and integration tests verify service logic produces correct output',
    'Edge cases such as empty records and errors are handled and tested',
  ],
};
