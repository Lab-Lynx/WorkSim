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

    const reactTemplate = getTicketTemplate('react-add-button');
    expect(reactTemplate.category).toBe('frontend');
    expect(reactTemplate.touchedFiles).toContain('src/App.tsx');

    const nodeTemplate = getTicketTemplate('node-add-route');
    expect(nodeTemplate.category).toBe('backend');
    expect(nodeTemplate.touchedFiles).toContain('src/routes/index.ts');

    const djangoTemplate = getTicketTemplate('django-add-model');
    expect(djangoTemplate.category).toBe('backend');
    expect(djangoTemplate.touchedFiles).toContain('app/models.py');
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
    });
  });
});
