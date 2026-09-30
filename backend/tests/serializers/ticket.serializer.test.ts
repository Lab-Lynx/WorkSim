import { describe, expect, it } from 'vitest';
import { TicketStatus } from '@prisma/client';
import {
  serializeTicket,
  serializeSubmissionSummary,
} from '../../src/serializers/ticket.serializer.js';

const content = {
  title: 'Add a button',
  scenario: 'Wire a button',
  category: 'frontend',
  difficulty: 'beginner',
  touchedFiles: ['src/App.tsx'],
  acceptanceCriteria: ['Button renders'],
  testChecklist: ['Unit test'],
};

describe('ticket.serializer', () => {
  it('serializeTicket flattens content into Doc 5 Ticket keys', () => {
    const createdAt = new Date('2026-01-02T03:04:05.000Z');
    const result = serializeTicket(
      {
        id: 't1',
        status: TicketStatus.assigned,
        templateKey: 'react-add-button',
        content,
        branchName: 'ticket/x',
        createdAt,
        completedAt: null,
        abandonedAt: null,
      },
      { fullName: 'ada/starter', defaultBranch: 'main' },
    );

    expect(Object.keys(result).sort()).toEqual(
      [
        'abandonedAt',
        'acceptanceCriteria',
        'branchName',
        'category',
        'completedAt',
        'createdAt',
        'difficulty',
        'id',
        'repo',
        'scenario',
        'status',
        'templateKey',
        'testChecklist',
        'title',
        'touchedFiles',
      ].sort(),
    );
    expect(result.title).toBe(content.title);
    expect(result.repo).toEqual({ fullName: 'ada/starter', defaultBranch: 'main' });
    expect(result.createdAt).toBe(createdAt.toISOString());
    expect(result).not.toHaveProperty('content');
  });

  it('serializeSubmissionSummary never includes diff and builds prUrl', () => {
    const submittedAt = new Date('2026-01-02T03:04:05.000Z');
    const result = serializeSubmissionSummary(
      {
        id: 's1',
        attempt: 1,
        status: 'completed',
        prNumber: 7,
        headSha: 'abc',
        ciPassed: true,
        ciRunUrl: null,
        failureReason: null,
        submittedAt,
        evaluation: {
          feedback: 'nice',
          requirementsMetScore: null,
          correctnessTestsScore: null,
          codeQualityScore: null,
          problemSolvingScore: null,
          totalScore: null,
          createdAt: submittedAt,
        },
      },
      'owner/name',
    );

    expect(result).not.toHaveProperty('diff');
    expect(result.prUrl).toBe('https://github.com/owner/name/pull/7');
    expect(result.evaluation?.scores).toBeNull();
  });

  it('serializeSubmissionSummary maps attempt-2 evaluation scores', () => {
    const submittedAt = new Date('2026-01-02T03:04:05.000Z');
    const result = serializeSubmissionSummary(
      {
        id: 's2',
        attempt: 2,
        status: 'completed',
        prNumber: 7,
        headSha: 'def',
        ciPassed: true,
        ciRunUrl: null,
        failureReason: null,
        submittedAt,
        evaluation: {
          feedback: 'great',
          requirementsMetScore: 80,
          correctnessTestsScore: 60,
          codeQualityScore: 70,
          problemSolvingScore: 90,
          totalScore: 74.5,
          createdAt: submittedAt,
        },
      },
      'owner/name',
    );

    expect(result.evaluation?.scores).toEqual({
      requirementsMet: 80,
      correctnessTests: 60,
      codeQuality: 70,
      problemSolving: 90,
      total: 74.5,
    });
  });
});
