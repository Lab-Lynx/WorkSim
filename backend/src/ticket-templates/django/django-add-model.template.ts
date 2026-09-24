import type { TicketTemplate } from '../../types/domain.js';

export const djangoAddModelTemplate: TicketTemplate = {
  key: 'django-add-model',
  category: 'backend',
  difficulty: 'beginner',
  touchedFiles: ['app/models.py', 'app/views.py'],
  acceptanceCriteriaStructure: ['Define the model schema', 'Wire model into views'],
  testChecklistStructure: ['Model migration applies', 'View queries model correctly'],
};
