import type { TicketTemplate } from '../../types/domain.js';

export const djangoTaskFilteringTemplate: TicketTemplate = {
  key: 'django-task-filtering',
  category: 'backend',
  difficulty: 'intermediate',
  touchedFiles: [
    'core/views.py',
    'core/serializers.py',
    'core/tests/test_api.py',
  ],
  acceptanceCriteriaStructure: [
    'Support query parameter filtering on the task list endpoint',
    'Validate query parameters and reject invalid options with 400 Bad Request',
  ],
  testChecklistStructure: [
    'Integration tests verify filtering matches expected records',
    'Integration tests verify invalid or empty parameters are handled properly',
  ],
};
