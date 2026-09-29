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
    expect(hasTicketTemplate('react-add-navigation-page')).toBe(true);
    expect(hasTicketTemplate('react-dashboard-card')).toBe(true);
    expect(hasTicketTemplate('node-add-route')).toBe(true);
    expect(hasTicketTemplate('node-add-validation')).toBe(true);
    expect(hasTicketTemplate('node-service-feature')).toBe(true);
    expect(hasTicketTemplate('django-add-model')).toBe(true);
    expect(hasTicketTemplate('django-task-filtering')).toBe(true);
    expect(hasTicketTemplate('django-custom-action')).toBe(true);

    const reactTemplate = getTicketTemplate('react-add-button');
    expect(reactTemplate.category).toBe('frontend');
    expect(reactTemplate.touchedFiles).toContain('src/components/ui/button.tsx');

    const reactNavTemplate = getTicketTemplate('react-add-navigation-page');
    expect(reactNavTemplate.category).toBe('frontend');
    expect(reactNavTemplate.difficulty).toBe('intermediate');
    expect(reactNavTemplate.touchedFiles).toContain('src/components/layout/app-layout.tsx');

    const reactCardTemplate = getTicketTemplate('react-dashboard-card');
    expect(reactCardTemplate.category).toBe('frontend');
    expect(reactCardTemplate.difficulty).toBe('advanced');
    expect(reactCardTemplate.touchedFiles).toContain('src/components/ui/card.tsx');

    const nodeTemplate = getTicketTemplate('node-add-route');
    expect(nodeTemplate.category).toBe('backend');
    expect(nodeTemplate.difficulty).toBe('beginner');
    expect(nodeTemplate.touchedFiles).toContain('src/routes/index.ts');

    const nodeValidation = getTicketTemplate('node-add-validation');
    expect(nodeValidation.category).toBe('backend');
    expect(nodeValidation.difficulty).toBe('intermediate');
    expect(nodeValidation.touchedFiles).toContain('src/validators/notes.validator.ts');

    const nodeService = getTicketTemplate('node-service-feature');
    expect(nodeService.category).toBe('backend');
    expect(nodeService.difficulty).toBe('advanced');
    expect(nodeService.touchedFiles).toContain('src/services/notes.service.ts');

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
      touchedFiles: [
        'src/components/ui/button.tsx',
        'src/pages/home-page.tsx',
      ],
      acceptanceCriteriaStructure: [
        'Add a new button variant or action with accessible styling',
        'Integrate the action into the HomePage component',
      ],
      testChecklistStructure: [
        'Smoke test verifies the button renders with appropriate variant classes on HomePage',
        'Accessible focus and disabled state interactions work correctly',
      ],
    });

    // Verify alias works identically
    expect(getTicketTemplate('react-add-button')).toBe(template);
  });

  describe('React ticket templates (BE-072, BE-036; Doc 7 §7.2.8; Doc 1 §1.4.1; FR-31)', () => {
    // Exact file paths known to exist in Lab-Lynx/react_starter_template
    const REACT_STARTER_FILES = new Set([
      'src/components/ui/button.tsx',
      'src/components/ui/card.tsx',
      'src/components/layout/app-layout.tsx',
      'src/pages/home-page.tsx',
      'src/pages/not-found-page.tsx',
      'src/pages/error-page.tsx',
      'src/app/routes.tsx',
      'src/app/routes.test.tsx',
      'src/app/app.tsx',
      'src/app/query-client.ts',
      'src/lib/utils.ts',
      'src/main.tsx',
    ]);

    const REACT_TEMPLATE_KEYS = [
      'react-add-button',
      'react-add-navigation-page',
      'react-dashboard-card',
    ] as const;

    it('ships at least 3 templates for React with distinct difficulties', () => {
      const reactTemplates = getAllTicketTemplates().filter(
        (t) => t.category === 'frontend' && t.key.startsWith('react-'),
      );
      expect(reactTemplates.length).toBeGreaterThanOrEqual(3);

      const difficulties = new Set(reactTemplates.map((t) => t.difficulty));
      expect(difficulties.has('beginner')).toBe(true);
      expect(difficulties.has('intermediate')).toBe(true);
      expect(difficulties.has('advanced')).toBe(true);
    });

    it('ensures all touched files across all React templates exist in the React starter template', () => {
      for (const key of REACT_TEMPLATE_KEYS) {
        const template = getTicketTemplate(key);
        expect(template.touchedFiles.length).toBeGreaterThan(0);
        for (const file of template.touchedFiles) {
          expect(REACT_STARTER_FILES.has(file)).toBe(true);
          // Never use nonexistent legacy placeholder paths
          expect(file).not.toBe('src/App.tsx');
          expect(file).not.toBe('src/components/Button.tsx');
          expect(file.startsWith('src/')).toBe(true);
          expect(file.endsWith('.tsx') || file.endsWith('.ts')).toBe(true);
        }
      }
    });

    it('verifies react-add-button structure and fields', () => {
      const template = loadTicketTemplate('react-add-button');
      expect(template).toEqual({
        key: 'react-add-button',
        category: 'frontend',
        difficulty: 'beginner',
        touchedFiles: [
          'src/components/ui/button.tsx',
          'src/pages/home-page.tsx',
        ],
        acceptanceCriteriaStructure: [
          'Add a new button variant or action with accessible styling',
          'Integrate the action into the HomePage component',
        ],
        testChecklistStructure: [
          'Smoke test verifies the button renders with appropriate variant classes on HomePage',
          'Accessible focus and disabled state interactions work correctly',
        ],
      });
    });

    it('verifies react-add-navigation-page structure and fields', () => {
      const template = loadTicketTemplate('react-add-navigation-page');
      expect(template).toEqual({
        key: 'react-add-navigation-page',
        category: 'frontend',
        difficulty: 'intermediate',
        touchedFiles: [
          'src/components/layout/app-layout.tsx',
          'src/app/routes.tsx',
          'src/app/routes.test.tsx',
        ],
        acceptanceCriteriaStructure: [
          'Define a new route in the router children array',
          'Add corresponding navigation link in AppLayout with active state indicator',
        ],
        testChecklistStructure: [
          'Test verifies navigation link renders with active aria-current state when at the route',
          'Test verifies navigating to the route renders the page without throwing 404',
        ],
      });
    });

    it('verifies react-dashboard-card structure and fields', () => {
      const template = loadTicketTemplate('react-dashboard-card');
      expect(template).toEqual({
        key: 'react-dashboard-card',
        category: 'frontend',
        difficulty: 'advanced',
        touchedFiles: [
          'src/components/ui/card.tsx',
          'src/pages/home-page.tsx',
          'src/app/routes.test.tsx',
        ],
        acceptanceCriteriaStructure: [
          'Compose a structured dashboard widget utilizing CardHeader, CardTitle, and CardContent',
          'Implement responsive layout and error/empty state fallbacks within the view',
        ],
        testChecklistStructure: [
          'Integration test verifies card component renders required headings and sections',
          'Test verifies state changes update the card content appropriately',
        ],
      });
    });
  });

  describe('Node/Express ticket templates (BE-073, BE-037; Doc 7 §7.2.8; FR-31)', () => {
    // Exact file paths known to exist in Lab-Lynx/express-starter-template
    const EXPRESS_STARTER_FILES = new Set([
      'src/app.ts',
      'src/config.ts',
      'src/controllers/notes.controller.ts',
      'src/middleware/error-handler.ts',
      'src/middleware/validate.ts',
      'src/routes/index.ts',
      'src/routes/notes.routes.ts',
      'src/server.ts',
      'src/services/notes.service.ts',
      'src/utils/async-handler.ts',
      'src/utils/http-error.ts',
      'src/validators/notes.validator.ts',
      'tests/health.test.ts',
      'tests/notes.test.ts',
    ]);

    const NODE_TEMPLATE_KEYS = [
      'node-add-route',
      'node-add-validation',
      'node-service-feature',
    ] as const;

    it('ships at least 3 templates for Node/Express with distinct difficulties', () => {
      const nodeTemplates = getAllTicketTemplates().filter(
        (t) => t.category === 'backend' && t.key.startsWith('node-'),
      );
      expect(nodeTemplates.length).toBeGreaterThanOrEqual(3);

      const difficulties = new Set(nodeTemplates.map((t) => t.difficulty));
      expect(difficulties.has('beginner')).toBe(true);
      expect(difficulties.has('intermediate')).toBe(true);
      expect(difficulties.has('advanced')).toBe(true);
    });

    it('ensures all touched files across all Node/Express templates exist in the Node starter template', () => {
      for (const key of NODE_TEMPLATE_KEYS) {
        const template = getTicketTemplate(key);
        expect(template.touchedFiles.length).toBeGreaterThan(0);
        for (const file of template.touchedFiles) {
          expect(EXPRESS_STARTER_FILES.has(file)).toBe(true);
          // Never use nonexistent placeholder paths
          expect(file).not.toBe('src/controllers/health.controller.ts');
          expect(file.startsWith('src/') || file.startsWith('tests/')).toBe(true);
          expect(file.endsWith('.ts')).toBe(true);
        }
      }
    });

    it('verifies node-add-route structure and fields', () => {
      const template = loadTicketTemplate('node-add-route');
      expect(template).toEqual({
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
      });
    });

    it('verifies node-add-validation structure and fields', () => {
      const template = loadTicketTemplate('node-add-validation');
      expect(template).toEqual({
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
      });
    });

    it('verifies node-service-feature structure and fields', () => {
      const template = loadTicketTemplate('node-service-feature');
      expect(template).toEqual({
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
      });
    });
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
      expect(registry.get('react-add-navigation-page')).toBeDefined();
      expect(registry.get('react-dashboard-card')).toBeDefined();
      expect(registry.get('node-add-route')).toBeDefined();
      expect(registry.get('node-add-validation')).toBeDefined();
      expect(registry.get('node-service-feature')).toBeDefined();
      expect(registry.get('django-add-model')).toBeDefined();
      expect(registry.get('django-task-filtering')).toBeDefined();
      expect(registry.get('django-custom-action')).toBeDefined();
    });
  });
});
