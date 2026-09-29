import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EvaluationView from '@/components/ticket/EvaluationView';
import type { Submission } from '@/types';

const baseSubmission: Submission = {
    id: 'sub-123',
    attempt: 1,
    status: 'completed',
    prNumber: 42,
    prUrl: 'https://github.com/org/repo/pull/42',
    headSha: 'abc123def456',
    ciPassed: true,
    ciRunUrl: 'https://github.com/org/repo/actions/runs/999',
    failureReason: null,
    submittedAt: '2026-03-30T10:00:00Z',
    evaluation: {
        feedback: 'Great job handling edge cases and structuring your code clean!',
        scores: {
            requirementsMet: 100,
            correctnessTests: 90,
            codeQuality: 85,
            problemSolving: 95,
            total: 93,
        },
        createdAt: '2026-03-30T10:05:00Z',
    },
};

describe('EvaluationView', () => {
    it('renders attempt title, PR link, CI status badge, and CI logs link', () => {
        render(<EvaluationView submission={baseSubmission} />);

        // Header title check
        expect(screen.getByRole('heading', { level: 2, name: /attempt 1 evaluation/i })).toBeInTheDocument();

        // PR Link check
        const prLink = screen.getByRole('link', { name: /#42/i });
        expect(prLink).toBeInTheDocument();
        expect(prLink).toHaveAttribute('href', 'https://github.com/org/repo/pull/42');

        // CI Status Badge check
        expect(screen.getByText('Tests passed')).toBeInTheDocument();

        // CI Logs link check
        const ciLogsLink = screen.getByRole('link', { name: /view ci run details/i });
        expect(ciLogsLink).toBeInTheDocument();
        expect(ciLogsLink).toHaveAttribute('href', 'https://github.com/org/repo/actions/runs/999');
    });

    it('renders Attempt 2 heading when attempt is 2', () => {
        const attempt2Submission: Submission = {
            ...baseSubmission,
            attempt: 2,
        };

        render(<EvaluationView submission={attempt2Submission} />);

        expect(screen.getByRole('heading', { level: 2, name: /attempt 2 evaluation/i })).toBeInTheDocument();
    });

    it('renders evaluation feedback and score breakdown', () => {
        render(<EvaluationView submission={baseSubmission} />);

        // Feedback content check
        expect(screen.getByText(/great job handling edge cases/i)).toBeInTheDocument();

        // Score breakdown title and values from ScoreBreakdown component
        expect(screen.getByRole('heading', { level: 3, name: /score breakdown/i })).toBeInTheDocument();
        expect(screen.getByText('93')).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
        expect(screen.getByText('90%')).toBeInTheDocument();
    });

    it('renders failure message when evaluation status is failed', () => {
        const failedSubmission: Submission = {
            ...baseSubmission,
            status: 'failed',
            failureReason: 'CI test suite execution timed out.',
            evaluation: null,
        };

        render(<EvaluationView submission={failedSubmission} />);

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/evaluation failed/i)).toBeInTheDocument();
        expect(screen.getByText(/ci test suite execution timed out/i)).toBeInTheDocument();
    });

    it('renders fallbacks when optional CI run url or evaluation scores are missing', () => {
        const minimalSubmission: Submission = {
            ...baseSubmission,
            ciRunUrl: null,
            evaluation: {
                feedback: 'Simple feedback with no scores available.',
                scores: null,
                createdAt: '2026-03-30T10:05:00Z',
            },
        };

        render(<EvaluationView submission={minimalSubmission} />);

        // CI Logs link should not be present
        expect(screen.queryByRole('link', { name: /view ci run details/i })).not.toBeInTheDocument();

        // Feedback is shown
        expect(screen.getByText(/simple feedback with no scores available/i)).toBeInTheDocument();

        // Fallback message for missing score breakdown
        expect(screen.getByText(/no score breakdown available for this evaluation/i)).toBeInTheDocument();
    });
});