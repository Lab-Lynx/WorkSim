import type { TicketTemplate } from '../../types/domain.js';

export const djangoCustomActionTemplate: TicketTemplate = {
  key: 'django-custom-action',
  category: 'backend',
  difficulty: 'advanced',
  touchedFiles: [
    'core/models.py',
    'core/views.py',
    'core/serializers.py',
    'core/urls.py',
    'core/tests/test_api.py',
  ],
  acceptanceCriteriaStructure: [
    'Implement domain method on the model for state transition or custom action',
    'Add custom REST action endpoint on the viewset with appropriate HTTP status codes',
  ],
  testChecklistStructure: [
    'Test verifies valid action executes state transition and updates timestamps',
    'Test verifies invalid state transition returns 400 Bad Request with descriptive error',
  ],
};
