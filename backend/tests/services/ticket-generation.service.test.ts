import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';

const generateTicketWording = vi.fn();

vi.mock('../../src/integrations/gemini.js', () => ({
  generateTicketWording,
}));

const {
  loadTicketTemplate,
  selectNextTicketTemplate,
  generateTicketContent,
} = await import('../../src/services/ticket-generation.service.js');

const template = loadTicketTemplate('react-add-button');

describe('ticket-generation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadTicketTemplate returns a known template and rejects unknown keys', () => {
    expect(loadTicketTemplate('react-add-button').key).toBe('react-add-button');
    expect(() => loadTicketTemplate('nope')).toThrow(
      expect.objectContaining({ statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR }),
    );
  });

  it('selectNextTicketTemplate returns a loadable key', async () => {
    const selection = await selectNextTicketTemplate('user-1');
    expect(loadTicketTemplate(selection.templateKey).key).toBe(selection.templateKey);
  });

  it('generateTicketContent validates Gemini output against the template', async () => {
    generateTicketWording.mockResolvedValue({
      title: 'T',
      scenario: 'S',
      category: template.category,
      difficulty: template.difficulty,
      touchedFiles: [...template.touchedFiles],
      acceptanceCriteria: ['a'],
      testChecklist: ['b'],
    });

    const content = await generateTicketContent(template, {
      userId: 'u1',
      starterTemplate: 'react',
    });
    expect(content.category).toBe(template.category);
    expect(content.touchedFiles).toEqual(template.touchedFiles);
  });

  it('generateTicketContent rejects content that contradicts the template', async () => {
    generateTicketWording.mockResolvedValue({
      title: 'T',
      scenario: 'S',
      category: template.category,
      difficulty: 'expert',
      touchedFiles: [...template.touchedFiles],
      acceptanceCriteria: ['a'],
      testChecklist: ['b'],
    });

    await expect(
      generateTicketContent(template, { userId: 'u1', starterTemplate: 'react' }),
    ).rejects.toMatchObject({
      statusCode: HTTP_STATUS.BAD_GATEWAY,
    });
  });

  it('generateTicketContent maps provider failures to 502', async () => {
    generateTicketWording.mockRejectedValue(new Error('timeout'));
    await expect(
      generateTicketContent(template, { userId: 'u1', starterTemplate: 'react' }),
    ).rejects.toMatchObject({
      statusCode: HTTP_STATUS.BAD_GATEWAY,
      message: 'Could not generate a ticket, please try again',
    });
  });
});
