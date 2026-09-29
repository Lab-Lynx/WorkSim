import { describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';
import {
  SHIPPED_TICKET_TEMPLATES,
  buildTicketTemplateRegistry,
  getAllTicketTemplates,
  getTicketTemplate,
  hasTicketTemplate,
  loadTicketTemplate,
  ticketTemplateSchema,
} from '../../src/ticket-templates/index.js';

describe('ticket-templates registry (Doc 7 §7.2.8; Doc 8 §8.7; Doc 9 §9.2.7)', () => {
  it('loads all shipped templates at startup and every shipped template is valid against schema', () => {
    const all = getAllTicketTemplates();
    expect(all.length).toBeGreaterThanOrEqual(3);

    for (const template of all) {
      const parsed = ticketTemplateSchema.safeParse(template);
      expect(parsed.success).toBe(true);
      expect(template.key).toBeDefined();
      expect(typeof template.key).toBe('string');
      expect(template.category).toBeDefined();
      expect(template.difficulty).toBeDefined();
      expect(Array.isArray(template.touchedFiles)).toBe(true);
      expect(template.touchedFiles.length).toBeGreaterThan(0);
      expect(Array.isArray(template.acceptanceCriteriaStructure)).toBe(true);
      expect(template.acceptanceCriteriaStructure.length).toBeGreaterThan(0);
      expect(Array.isArray(template.testChecklistStructure)).toBe(true);
      expect(template.testChecklistStructure.length).toBeGreaterThan(0);
    }
  });

  it('ships templates covering React, Node/Express, and Django (D-05)', () => {
    expect(hasTicketTemplate('react-add-button')).toBe(true);
    expect(hasTicketTemplate('node-add-route')).toBe(true);
    expect(hasTicketTemplate('django-add-model')).toBe(true);
    expect(hasTicketTemplate('django-task-filtering')).toBe(true);
    expect(hasTicketTemplate('django-custom-action')).toBe(true);

    const reactTemplate = getTicketTemplate('react-add-button');
    expect(reactTemplate.category).toBe('frontend');
    expect(reactTemplate.touchedFiles).toContain('src/App.tsx');

    const nodeTemplate = getTicketTemplate('node-add-route');
    expect(nodeTemplate.category).toBe('backend');
    expect(nodeTemplate.touchedFiles).toContain('src/routes/index.ts');

    const djangoModel = getTicketTemplate('django-add-model');
    expect(djangoModel.category).toBe('backend');
    expect(djangoModel.difficulty).toBe('beginner');
    expect(djangoModel.touchedFiles).toContain('core/models.py');

    const djangoFilter = getTicketTemplate('django-task-filtering');
    expect(djangoFilter.category).toBe('backend');
    expect(djangoFilter.difficulty).toBe('intermediate');
    expect(djangoFilter.touchedFiles).toContain('core/views.py');

    const djangoAction = getTicketTemplate('django-custom-action');
    expect(djangoAction.category).toBe('backend');
    expect(djangoAction.difficulty).toBe('advanced');
    expect(djangoAction.touchedFiles).toContain('core/models.py');
  });

  it('loadTicketTemplate / getTicketTemplate returns typed template for a known key', () => {
    const template = loadTicketTemplate('react-add-button');
    expect(template).toEqual({
      key: 'react-add-button',
      category: 'frontend',
      difficulty: 'beginner',
      touchedFiles: ['src/App.tsx', 'src/components/Button.tsx'],
      acceptanceCriteriaStructure: ['Add a reusable button', 'Wire it into the page'],
      testChecklistStructure: ['Unit test the button', 'Smoke-test the page'],
    });

    // Verify alias works identically
    expect(getTicketTemplate('react-add-button')).toBe(template);
  });

  describe('Django ticket templates (BE-074, BE-038; Doc 7 §7.2.8; FR-31; D-05)', () => {
    // Exact file paths known to exist in Lab-Lynx/django_starter_template
    const DJANGO_STARTER_FILES = new Set([
      'config/settings.py',
      'config/urls.py',
      'core/admin.py',
      'core/apps.py',
      'core/models.py',
      'core/serializers.py',
      'core/urls.py',
      'core/views.py',
      'core/tests/test_api.py',
      'core/tests/test_models.py',
    ]);

    const DJANGO_TEMPLATE_KEYS = [
      'django-add-model',
      'django-task-filtering',
      'django-custom-action',
    ] as const;

    it('ships at least 3 templates for Django with distinct difficulties', () => {
      const djangoTemplates = getAllTicketTemplates().filter(
        (t) => t.category === 'backend' && t.key.startsWith('django-'),
      );
      expect(djangoTemplates.length).toBeGreaterThanOrEqual(3);

      const difficulties = new Set(djangoTemplates.map((t) => t.difficulty));
      expect(difficulties.has('beginner')).toBe(true);
      expect(difficulties.has('intermediate')).toBe(true);
      expect(difficulties.has('advanced')).toBe(true);
    });

    it('ensures all touched files across all Django templates exist in the Django starter template', () => {
      for (const key of DJANGO_TEMPLATE_KEYS) {
        const template = getTicketTemplate(key);
        expect(template.touchedFiles.length).toBeGreaterThan(0);
        for (const file of template.touchedFiles) {
          expect(DJANGO_STARTER_FILES.has(file)).toBe(true);
          // Never use legacy placeholder "app/" directory
          expect(file.startsWith('app/')).toBe(false);
          // Standard relative path starting with core/ or config/
          expect(file.startsWith('core/') || file.startsWith('config/')).toBe(true);
          expect(file.endsWith('.py')).toBe(true);
        }
      }
    });

    it('verifies django-add-model structure and fields', () => {
      const template = loadTicketTemplate('django-add-model');
      expect(template).toEqual({
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
      });
    });

    it('verifies django-task-filtering structure and fields', () => {
      const template = loadTicketTemplate('django-task-filtering');
      expect(template).toEqual({
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
      });
    });

    it('verifies django-custom-action structure and fields', () => {
      const template = loadTicketTemplate('django-custom-action');
      expect(template).toEqual({
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
      });
    });
  });

  it('loadTicketTemplate fails loudly on unknown keys with 500 internal server error', () => {
    expect(() => loadTicketTemplate('non-existent-template-key')).toThrow(
      expect.objectContaining({
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: expect.stringContaining('Unknown ticket template: non-existent-template-key'),
      }),
    );
  });

  it('loadTicketTemplate fails loudly on invalid/empty keys', () => {
    expect(() => loadTicketTemplate('')).toThrow(
      expect.objectContaining({
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      }),
    );
    expect(() => loadTicketTemplate(null as unknown as string)).toThrow(
      expect.objectContaining({
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      }),
    );
  });

  it('hasTicketTemplate accurately detects existence without throwing', () => {
    expect(hasTicketTemplate('react-add-button')).toBe(true);
    expect(hasTicketTemplate('non-existent')).toBe(false);
    expect(hasTicketTemplate('')).toBe(false);
    expect(hasTicketTemplate(undefined as unknown as string)).toBe(false);
  });

  describe('buildTicketTemplateRegistry validation (Doc 9 §9.2.7 edge cases)', () => {
    it('throws at load time if duplicate keys exist', () => {
      const duplicateTemplates = [
        {
          key: 'duplicate-key',
          category: 'frontend',
          difficulty: 'beginner',
          touchedFiles: ['fileA.ts'],
          acceptanceCriteriaStructure: ['Crit 1'],
          testChecklistStructure: ['Test 1'],
        },
        {
          key: 'duplicate-key',
          category: 'backend',
          difficulty: 'intermediate',
          touchedFiles: ['fileB.ts'],
          acceptanceCriteriaStructure: ['Crit 2'],
          testChecklistStructure: ['Test 2'],
        },
      ];

      expect(() => buildTicketTemplateRegistry(duplicateTemplates)).toThrow(
        expect.objectContaining({
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: expect.stringContaining('Duplicate ticket template key in registry: duplicate-key'),
        }),
      );
    });

    it('throws if a template is missing a required field (malformed)', () => {
      const missingCategory = {
        key: 'missing-category',
        difficulty: 'beginner',
        touchedFiles: ['file.ts'],
        acceptanceCriteriaStructure: ['Crit 1'],
        testChecklistStructure: ['Test 1'],
      };

      expect(() => buildTicketTemplateRegistry([missingCategory])).toThrow(
        expect.objectContaining({
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: expect.stringContaining('Malformed ticket template configuration'),
        }),
      );

      const missingTouchedFiles = {
        key: 'missing-touched',
        category: 'backend',
        difficulty: 'beginner',
        acceptanceCriteriaStructure: ['Crit 1'],
        testChecklistStructure: ['Test 1'],
      };

      expect(() => buildTicketTemplateRegistry([missingTouchedFiles])).toThrow(
        expect.objectContaining({
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: expect.stringContaining('Malformed ticket template configuration'),
        }),
      );

      const emptyCriteria = {
        key: 'empty-criteria',
        category: 'backend',
        difficulty: 'beginner',
        touchedFiles: ['file.ts'],
        acceptanceCriteriaStructure: [],
        testChecklistStructure: ['Test 1'],
      };

      expect(() => buildTicketTemplateRegistry([emptyCriteria])).toThrow(
        expect.objectContaining({
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: expect.stringContaining('Malformed ticket template configuration'),
        }),
      );
    });

    it('throws if field types are wrong', () => {
      const wrongType = {
        key: 12345,
        category: 'backend',
        difficulty: 'beginner',
        touchedFiles: ['file.ts'],
        acceptanceCriteriaStructure: ['Crit 1'],
        testChecklistStructure: ['Test 1'],
      };

      expect(() => buildTicketTemplateRegistry([wrongType])).toThrow(
        expect.objectContaining({
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        }),
      );
    });

    it('builds a clean Map registry when all templates are valid', () => {
      const registry = buildTicketTemplateRegistry(SHIPPED_TICKET_TEMPLATES);
      expect(registry).toBeInstanceOf(Map);
      expect(registry.get('react-add-button')).toBeDefined();
      expect(registry.get('node-add-route')).toBeDefined();
      expect(registry.get('django-add-model')).toBeDefined();
      expect(registry.get('django-task-filtering')).toBeDefined();
      expect(registry.get('django-custom-action')).toBeDefined();
    });
  });
});
