import type { TicketTemplate } from '../../types/domain.js';

export const nodeAddValidationTemplate: TicketTemplate = {
  key: 'node-add-validation',
  category: 'backend',
  difficulty: 'intermediate',
  touchedFiles: [
    'src/validators/notes.validator.ts',
    'src/routes/notes.routes.ts',
    'tests/notes.test.ts',
  ],
  acceptanceCriteriaStructure: [
    'Define schema validation rules using Zod in notes validator',
    'Attach validate middleware to reject invalid request payloads with 400 Bad Request',
  ],
  testChecklistStructure: [
    'Integration test verifies invalid payloads return 400 with descriptive error message',
    'Integration test verifies valid request payloads pass validation successfully',
  ],
};
