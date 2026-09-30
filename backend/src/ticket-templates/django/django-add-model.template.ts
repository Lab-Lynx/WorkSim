import type { TicketTemplate } from '../../types/domain.js';

export const djangoAddModelTemplate: TicketTemplate = {
  key: 'django-add-model',
  category: 'backend',
  difficulty: 'beginner',
  touchedFiles: [
    'core/models.py',
    'core/serializers.py',
    'core/tests/test_models.py',
  ],
  acceptanceCriteriaStructure: [
    'Define the model schema with required fields and choices',
    'Expose the new field in the model serializer',
  ],
  testChecklistStructure: [
    'Model migration applies cleanly without errors',
    'Unit tests verify model field defaults and validation rules',
  ],
};
