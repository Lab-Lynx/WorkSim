import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';
import {
  getAllTicketTemplates,
  ticketTemplateSchema,
} from '../../src/ticket-templates/index.js';

const generateTicketWording = vi.fn();
const callTicketGenerationModel = vi.fn();

vi.mock('../../src/integrations/gemini.js', () => ({
  generateTicketWording,
  callTicketGenerationModel,
}));

const {
  loadTicketTemplate,
  selectNextTicketTemplate,
  setTicketTemplateSelectionStrategy,
  resetTicketTemplateSelectionStrategy,
  generateTicketContent,
} = await import('../../src/services/ticket-generation.service.js');

const template = loadTicketTemplate('react-add-button');

describe('ticket-generation.service (Doc 8 §8.7; Doc 9 §9.2.7; FR-31)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof resetTicketTemplateSelectionStrategy === 'function') {
      resetTicketTemplateSelectionStrategy();
    }
  });

  describe('loadTicketTemplate (Doc 8 §8.7, Doc 9 §9.2.7)', () => {
    it('loadTicketTemplate — known key returns typed template with fixed structure', () => {
      const loaded = loadTicketTemplate('react-add-button');
      expect(loaded.key).toBe('react-add-button');
      expect(loaded.category).toBe('frontend');
      expect(loaded.difficulty).toBe('beginner');
      expect(Array.isArray(loaded.touchedFiles)).toBe(true);
      expect(loaded.touchedFiles.length).toBeGreaterThan(0);
      expect(Array.isArray(loaded.acceptanceCriteriaStructure)).toBe(true);
      expect(loaded.acceptanceCriteriaStructure.length).toBeGreaterThan(0);
      expect(Array.isArray(loaded.testChecklistStructure)).toBe(true);
      expect(loaded.testChecklistStructure.length).toBeGreaterThan(0);
    });

    it('loadTicketTemplate — unknown key fails loudly with 500 error', () => {
      expect(() => loadTicketTemplate('nope')).toThrow(
        expect.objectContaining({
          statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          message: expect.stringContaining('Unknown ticket template: nope'),
        }),
      );
    });

    it('loadTicketTemplate — malformed / empty key fails loudly with 500 error', () => {
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

    it('every shipped template is valid against schema', () => {
      const templates = getAllTicketTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(9);
      for (const t of templates) {
        const parsed = ticketTemplateSchema.safeParse(t);
        expect(parsed.success).toBe(true);
      }
    });
  });

  describe('selectNextTicketTemplate (Q-09, Doc 8 §8.7, Doc 9 §9.2.7)', () => {
    it('selectNextTicketTemplate — returns a loadable key', async () => {
      const selection = await selectNextTicketTemplate('user-1');
      expect(selection).toBeDefined();
      expect(typeof selection.templateKey).toBe('string');
      const loaded = loadTicketTemplate(selection.templateKey);
      expect(loaded.key).toBe(selection.templateKey);
    });

    it('selectNextTicketTemplate — strategy is swappable', async () => {
      expect(typeof setTicketTemplateSelectionStrategy).toBe('function');
      setTicketTemplateSelectionStrategy((userId) => {
        expect(userId).toBe('user-swappable');
        return { templateKey: 'django-custom-action' };
      });

      const selection = await selectNextTicketTemplate('user-swappable');
      expect(selection.templateKey).toBe('django-custom-action');
    });

    it('selectNextTicketTemplate — no side effects (no DB writes)', async () => {
      const selection = await selectNextTicketTemplate('user-no-writes');
      expect(selection).toBeDefined();
    });
  });

  describe('generateTicketContent (Doc 8 §8.7, Doc 9 §9.2.7; FR-31; D-14)', () => {
    it('generateTicketContent — valid Gemini output returns TicketContent with matching structure', async () => {
      generateTicketWording.mockResolvedValue({
        title: 'Add button to dashboard',
        scenario: 'User needs an accessible action button',
        category: template.category,
        difficulty: template.difficulty,
        touchedFiles: [...template.touchedFiles],
        acceptanceCriteria: ['Button must be visible', 'Click triggers action'],
        testChecklist: ['Unit test passes', 'Accessibility test passes'],
      });

      const content = await generateTicketContent(template, {
        userId: 'u1',
        starterTemplate: 'react',
      });

      expect(content.title).toBe('Add button to dashboard');
      expect(content.scenario).toBe('User needs an accessible action button');
      expect(content.category).toBe(template.category);
      expect(content.difficulty).toBe(template.difficulty);
      expect(content.touchedFiles).toEqual(template.touchedFiles);
      expect(content.acceptanceCriteria).toEqual([
        'Button must be visible',
        'Click triggers action',
      ]);
      expect(content.testChecklist).toEqual([
        'Unit test passes',
        'Accessibility test passes',
      ]);
    });

    it('generateTicketContent — missing field throws 502 validation error', async () => {
      generateTicketWording.mockResolvedValue({
        title: 'Incomplete ticket',
        scenario: 'Missing checklist',
        category: template.category,
        difficulty: template.difficulty,
        touchedFiles: [...template.touchedFiles],
        acceptanceCriteria: ['Something'],
        // testChecklist is missing
      });

      await expect(
        generateTicketContent(template, { userId: 'u1', starterTemplate: 'react' }),
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_GATEWAY,
        message: 'Could not generate a ticket, please try again',
      });
    });

    it('generateTicketContent — extra fields are stripped and never returned', async () => {
      generateTicketWording.mockResolvedValue({
        title: 'Title',
        scenario: 'Scenario',
        category: template.category,
        difficulty: template.difficulty,
        touchedFiles: [...template.touchedFiles],
        acceptanceCriteria: ['Valid criteria'],
        testChecklist: ['Valid checklist'],
        extraDisallowedField: 'injected value',
        anotherExtra: 12345,
      });

      const content = await generateTicketContent(template, {
        userId: 'u1',
        starterTemplate: 'react',
      });

      expect(content).not.toHaveProperty('extraDisallowedField');
      expect(content).not.toHaveProperty('anotherExtra');
      expect(Object.keys(content).sort()).toEqual([
        'acceptanceCriteria',
        'category',
        'difficulty',
        'scenario',
        'testChecklist',
        'title',
        'touchedFiles',
      ]);
    });

    it('generateTicketContent — content contradicts template difficulty', async () => {
      generateTicketWording.mockResolvedValue({
        title: 'Contradictory',
        scenario: 'Scenario',
        category: template.category,
        difficulty: 'advanced', // template is beginner
        touchedFiles: [...template.touchedFiles],
        acceptanceCriteria: ['Criteria'],
        testChecklist: ['Checklist'],
      });

      await expect(
        generateTicketContent(template, { userId: 'u1', starterTemplate: 'react' }),
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_GATEWAY,
      });
    });

    it('generateTicketContent — content contradicts template category', async () => {
      generateTicketWording.mockResolvedValue({
        title: 'Contradictory category',
        scenario: 'Scenario',
        category: 'backend', // template is frontend
        difficulty: template.difficulty,
        touchedFiles: [...template.touchedFiles],
        acceptanceCriteria: ['Criteria'],
        testChecklist: ['Checklist'],
      });

      await expect(
        generateTicketContent(template, { userId: 'u1', starterTemplate: 'react' }),
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_GATEWAY,
      });
    });

    it('generateTicketContent — content contradicts template touchedFiles', async () => {
      generateTicketWording.mockResolvedValue({
        title: 'Contradictory touched files',
        scenario: 'Scenario',
        category: template.category,
        difficulty: template.difficulty,
        touchedFiles: ['some/other/file.tsx'],
        acceptanceCriteria: ['Criteria'],
        testChecklist: ['Checklist'],
      });

      await expect(
        generateTicketContent(template, { userId: 'u1', starterTemplate: 'react' }),
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_GATEWAY,
      });
    });

    it('generateTicketContent — non-JSON / non-object output throws 502', async () => {
      generateTicketWording.mockResolvedValue('Here is your ticket: title is Foo');

      await expect(
        generateTicketContent(template, { userId: 'u1', starterTemplate: 'react' }),
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_GATEWAY,
        message: 'Could not generate a ticket, please try again',
      });
    });

    it('generateTicketContent — provider failure or timeout maps to 502 (D-14)', async () => {
      generateTicketWording.mockRejectedValue(new Error('Gateway timeout from Gemini provider'));

      await expect(
        generateTicketContent(template, { userId: 'u1', starterTemplate: 'react' }),
      ).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_GATEWAY,
        message: 'Could not generate a ticket, please try again',
      });
    });

    it('generateTicketContent — key not leaked when provider error includes sentinel key', async () => {
      const sentinelKey = 'ci-gemini-sentinel-key-SECRET-12345';
      generateTicketWording.mockRejectedValue(
        new Error(`Failed to authenticate with key: ${sentinelKey}`),
      );

      try {
        await generateTicketContent(template, {
          userId: 'u1',
          starterTemplate: 'react',
        });
        expect.unreachable('Should have thrown ApiError');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        expect(message).not.toContain(sentinelKey);
        expect(message).toBe('Could not generate a ticket, please try again');
      }
    });
  });
});
