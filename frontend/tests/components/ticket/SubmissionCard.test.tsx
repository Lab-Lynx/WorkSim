import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SubmissionCard from '@/components/ticket/SubmissionCard';
import type { Submission } from '@/types';

const mockSubmission: Submission = {
    id: 'sub-123',
    attempt: 1,
    status: 'completed',
    prNumber: 42,
    prUrl: 'https://github.com/example/repo/pull/42',
    headSha: 'a1b2c3d4e5f6',
    ciPassed: true,
    ciRunUrl: 'https://github.com/example/repo/actions/runs/100',
    failureReason: null,
    submittedAt: '2026-09-29T18:00:00Z',
    evaluation: {
        createdAt: '2026-09-29T19:00:00Z',
        feedback: 'Great job on the implementation!',
        scores: {
            requirementsMet: 90,
            correctnessTests: 85,
            codeQuality: 88,
            problemSolving: 80,
            total: 86,
        },
    },
    diff: '@@ -1,2 +1,10 @@\n+console.log("Hello World");',
};

describe('SubmissionCard Component', () => {
    it('renders the evaluation view by default', () => {
        render(<SubmissionCard submission={mockSubmission} />);

        // Checks default active tab button
        const evalTab = screen.getByRole('tab', { name: /evaluation/i });
        expect(evalTab).toHaveAttribute('aria-selected', 'true');

        // Checks Evaluation content rendering
        expect(screen.getByText('Attempt 1 Evaluation')).toBeInTheDocument();
        expect(screen.getByText('Great job on the implementation!')).toBeInTheDocument();
    });

    it('switches to diff view when the diff tab is clicked', () => {
        render(<SubmissionCard submission={mockSubmission} />);

        const diffTab = screen.getByRole('tab', { name: /diff changes/i });
        fireEvent.click(diffTab);

        // Checks active state transfer
        expect(diffTab).toHaveAttribute('aria-selected', 'true');

        // Checks DiffViewer content rendering
        expect(screen.getByText('changes.patch')).toBeInTheDocument();
    });
});