import { describe, expect, it } from 'vitest';
import {
  getTicketPhase,
  getTicketStatusLabel,
  TICKET_PHASE_LABELS,
  type TicketPhaseKey,
} from '@/lib/ticket-phase';
import type { Submission, SubmissionStatus, Ticket, TicketStatus } from '@/types';

describe('ticket-phase helpers', () => {
  function createTicket(status: TicketStatus | string): Ticket {
    return {
      id: '22222222-2222-4222-8222-222222222222',
      status: status as TicketStatus,
      templateKey: 'react',
      title: 'Fix navigation redirect',
      scenario: 'Open redirects allow arbitrary external destinations.',
      category: 'Security',
      difficulty: 'Medium',
      touchedFiles: ['src/lib/navigation.ts'],
      acceptanceCriteria: ['Prevent open redirects'],
      testChecklist: ['Unit tests pass'],
      branchName: 'fix/navigation',
      repo: {
        fullName: 'octo-org/work-sim',
        defaultBranch: 'main',
      },
      createdAt: '2026-09-24T08:00:00.000Z',
      completedAt: null,
      abandonedAt: null,
    };
  }

  function createSubmission(attempt: 1 | 2, status: SubmissionStatus): Submission {
    return {
      id: `33333333-3333-4333-8333-33333333333${attempt}`,
      attempt,
      status,
      prNumber: 42,
      prUrl: 'https://github.com/octo-org/work-sim/pull/42',
      headSha: 'abc1234',
      ciPassed: status === 'completed',
      ciRunUrl: 'https://github.com/octo-org/work-sim/actions/runs/1',
      failureReason: status === 'failed' ? 'CI test suite failed' : null,
      submittedAt: '2026-09-24T09:00:00.000Z',
      evaluation:
        status === 'completed'
          ? {
              feedback: 'Great job!',
              scores: {
                requirementsMet: 40,
                correctnessTests: 25,
                codeQuality: 20,
                problemSolving: 15,
                total: 100,
              },
              createdAt: '2026-09-24T09:05:00.000Z',
            }
          : null,
    };
  }

  describe('getTicketPhase (Doc 10 §10.5 / Doc 6 PG-10 table)', () => {
    it('returns ready_to_start for assigned ticket with no submission', () => {
      const ticket = createTicket('assigned');
      const phase = getTicketPhase(ticket, []);

      expect(phase).toEqual({
        key: 'ready_to_start',
        label: 'Ready to start',
        primaryAction: 'start',
        retryAttempt: null,
        mentor: 'not_started',
        canAbandon: true,
        isProcessing: false,
        defaultTab: 'ticket',
      });
    });

    it('returns in_progress for in_progress ticket with no submission', () => {
      const ticket = createTicket('in_progress');
      const phase = getTicketPhase(ticket, []);

      expect(phase).toEqual({
        key: 'in_progress',
        label: 'In progress',
        primaryAction: 'submit',
        retryAttempt: null,
        mentor: 'enabled',
        canAbandon: true,
        isProcessing: false,
        defaultTab: 'ticket',
      });
    });

    describe('submitted_v1 (first review)', () => {
      it.each(['awaiting_ci', 'evaluating'] as const)(
        'returns first_review_processing and isProcessing: true when attempt 1 is %s',
        (status) => {
          const ticket = createTicket('submitted_v1');
          const sub1 = createSubmission(1, status);
          const phase = getTicketPhase(ticket, [sub1]);

          expect(phase).toEqual({
            key: 'first_review_processing',
            label: 'First review in progress',
            primaryAction: null,
            retryAttempt: null,
            mentor: 'unavailable_after_submit',
            canAbandon: false,
            isProcessing: true,
            defaultTab: 'submissions',
          });
        }
      );

      it('returns feedback_ready with resubmit action and enabled mentor (D-04) when attempt 1 is completed', () => {
        const ticket = createTicket('submitted_v1');
        const sub1 = createSubmission(1, 'completed');
        const phase = getTicketPhase(ticket, [sub1]);

        expect(phase).toEqual({
          key: 'feedback_ready',
          label: 'Feedback ready',
          primaryAction: 'resubmit',
          retryAttempt: null,
          mentor: 'enabled',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'submissions',
        });
      });

      it('returns first_review_failed and retryAttempt: 1 when attempt 1 failed', () => {
        const ticket = createTicket('submitted_v1');
        const sub1 = createSubmission(1, 'failed');
        const phase = getTicketPhase(ticket, [sub1]);

        expect(phase).toEqual({
          key: 'first_review_failed',
          label: 'Review failed',
          primaryAction: 'retry',
          retryAttempt: 1,
          mentor: 'unavailable_after_submit',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'submissions',
        });
      });
    });

    describe('resubmitted (final review)', () => {
      it.each(['awaiting_ci', 'evaluating'] as const)(
        'returns final_review_processing and isProcessing: true when attempt 2 is %s',
        (status) => {
          const ticket = createTicket('resubmitted');
          const sub1 = createSubmission(1, 'completed');
          const sub2 = createSubmission(2, status);
          const phase = getTicketPhase(ticket, [sub1, sub2]);

          expect(phase).toEqual({
            key: 'final_review_processing',
            label: 'Final review in progress',
            primaryAction: null,
            retryAttempt: null,
            mentor: 'unavailable_after_submit',
            canAbandon: false,
            isProcessing: true,
            defaultTab: 'submissions',
          });
        }
      );

      it('returns final_review_failed and retryAttempt: 2 when attempt 2 failed', () => {
        const ticket = createTicket('resubmitted');
        const sub1 = createSubmission(1, 'completed');
        const sub2 = createSubmission(2, 'failed');
        const phase = getTicketPhase(ticket, [sub1, sub2]);

        expect(phase).toEqual({
          key: 'final_review_failed',
          label: 'Final review failed',
          primaryAction: 'retry',
          retryAttempt: 2,
          mentor: 'unavailable_after_submit',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'submissions',
        });
      });

      it('returns final_review_finalizing when attempt 2 is completed while ticket is resubmitted (A-70)', () => {
        const ticket = createTicket('resubmitted');
        const sub1 = createSubmission(1, 'completed');
        const sub2 = createSubmission(2, 'completed');
        const phase = getTicketPhase(ticket, [sub1, sub2]);

        expect(phase).toEqual({
          key: 'final_review_finalizing',
          label: 'Finalizing',
          primaryAction: null,
          retryAttempt: null,
          mentor: 'unavailable_after_submit',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'submissions',
        });
      });
    });

    describe('terminal states (done and abandoned)', () => {
      it('returns done with get_next primaryAction and read_only mentor for done ticket', () => {
        const ticket = createTicket('done');
        const sub1 = createSubmission(1, 'completed');
        const sub2 = createSubmission(2, 'completed');
        const phase = getTicketPhase(ticket, [sub1, sub2]);

        expect(phase).toEqual({
          key: 'done',
          label: 'Done',
          primaryAction: 'get_next',
          retryAttempt: null,
          mentor: 'read_only',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'submissions',
        });
      });

      it('returns abandoned with no primaryAction and read_only mentor for abandoned ticket', () => {
        const ticket = createTicket('abandoned');
        const phase = getTicketPhase(ticket, []);

        expect(phase).toEqual({
          key: 'abandoned',
          label: 'Abandoned',
          primaryAction: null,
          retryAttempt: null,
          mentor: 'read_only',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'ticket',
        });
      });
    });

    describe('edge cases and robustness', () => {
      it('returns first_review_processing and isProcessing: true when submitted_v1 has no submission', () => {
        const ticket = createTicket('submitted_v1');
        const phase = getTicketPhase(ticket, []);

        expect(phase).toEqual({
          key: 'first_review_processing',
          label: 'First review in progress',
          primaryAction: null,
          retryAttempt: null,
          mentor: 'unavailable_after_submit',
          canAbandon: false,
          isProcessing: true,
          defaultTab: 'submissions',
        });
      });

      it('returns final_review_processing and isProcessing: true when resubmitted is missing attempt 2', () => {
        const ticket = createTicket('resubmitted');
        const sub1 = createSubmission(1, 'completed');
        const phase = getTicketPhase(ticket, [sub1]);

        expect(phase).toEqual({
          key: 'final_review_processing',
          label: 'Final review in progress',
          primaryAction: null,
          retryAttempt: null,
          mentor: 'unavailable_after_submit',
          canAbandon: false,
          isProcessing: true,
          defaultTab: 'submissions',
        });
      });

      it('treats highest attempt as latest when submissions are unordered', () => {
        const ticket = createTicket('resubmitted');
        const sub1 = createSubmission(1, 'completed');
        const sub2 = createSubmission(2, 'failed');

        // Reverse order
        const phase = getTicketPhase(ticket, [sub2, sub1]);

        expect(phase.key).toBe('final_review_failed');
        expect(phase.retryAttempt).toBe(2);
      });

      it('returns safe in-progress defaults for unknown ticket status', () => {
        const ticket = createTicket('some_future_status');
        const phase = getTicketPhase(ticket, []);

        expect(phase).toEqual({
          key: 'in_progress',
          label: 'In progress',
          primaryAction: null,
          retryAttempt: null,
          mentor: 'read_only',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'ticket',
        });
      });

      it('handles null/undefined/malformed ticket input defensively and never throws', () => {
        // @ts-expect-error testing defensive handling
        const phaseNull = getTicketPhase(null, []);
        expect(phaseNull).toEqual({
          key: 'in_progress',
          label: 'In progress',
          primaryAction: null,
          retryAttempt: null,
          mentor: 'read_only',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'ticket',
        });

        // @ts-expect-error testing defensive handling
        const phaseEmpty = getTicketPhase({}, undefined);
        expect(phaseEmpty).toEqual({
          key: 'in_progress',
          label: 'In progress',
          primaryAction: null,
          retryAttempt: null,
          mentor: 'read_only',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'ticket',
        });

        // @ts-expect-error testing defensive handling
        const phaseNonArraySubmissions = getTicketPhase(createTicket('assigned'), null);
        expect(phaseNonArraySubmissions.key).toBe('ready_to_start');
      });
    });
  });

  describe('TICKET_PHASE_LABELS constant', () => {
    it('contains all 10 declared ticket phase keys with matching labels', () => {
      const expectedKeys: TicketPhaseKey[] = [
        'ready_to_start',
        'in_progress',
        'first_review_processing',
        'feedback_ready',
        'first_review_failed',
        'final_review_processing',
        'final_review_failed',
        'final_review_finalizing',
        'done',
        'abandoned',
      ];

      for (const key of expectedKeys) {
        expect(TICKET_PHASE_LABELS[key]).toBeDefined();
        expect(typeof TICKET_PHASE_LABELS[key]).toBe('string');
      }

      expect(TICKET_PHASE_LABELS.ready_to_start).toBe('Ready to start');
      expect(TICKET_PHASE_LABELS.in_progress).toBe('In progress');
      expect(TICKET_PHASE_LABELS.first_review_processing).toBe('First review in progress');
      expect(TICKET_PHASE_LABELS.feedback_ready).toBe('Feedback ready');
      expect(TICKET_PHASE_LABELS.first_review_failed).toBe('Review failed');
      expect(TICKET_PHASE_LABELS.final_review_processing).toBe('Final review in progress');
      expect(TICKET_PHASE_LABELS.final_review_failed).toBe('Final review failed');
      expect(TICKET_PHASE_LABELS.final_review_finalizing).toBe('Finalizing');
      expect(TICKET_PHASE_LABELS.done).toBe('Done');
      expect(TICKET_PHASE_LABELS.abandoned).toBe('Abandoned');
    });
  });

  describe('getTicketStatusLabel', () => {
    it.each([
      ['assigned', 'Ready to start'],
      ['in_progress', 'In progress'],
      ['submitted_v1', 'First review'],
      ['resubmitted', 'Final review'],
      ['done', 'Done'],
      ['abandoned', 'Abandoned'],
    ] as const)('maps status %j to label %j', (status, expectedLabel) => {
      expect(getTicketStatusLabel(status)).toBe(expectedLabel);
    });

    it('returns string representation for unknown status', () => {
      expect(getTicketStatusLabel('future_status')).toBe('future_status');
    });
  });
});
