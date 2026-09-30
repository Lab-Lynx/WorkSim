import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import SubmissionCard from '@/components/ticket/SubmissionCard';
import type { Submission } from '@/types';
import { useSubmission } from '@/hooks/submissions/useSubmission';

vi.mock('@/hooks/submissions/useSubmission', () => ({ useSubmission: vi.fn() }));

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
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useSubmission).mockImplementation((_ticketId, _attempt, options) => ({
            query: {
                data: options?.includeDiff ? mockSubmission : undefined,
                isLoading: false,
                isError: false,
                error: null,
                refetch: vi.fn(),
            },
            showSlowHint: false,
            pollingStopped: false,
            restartPolling: vi.fn(),
        } as unknown as ReturnType<typeof useSubmission>));
    });

    const renderSubmission = (props: Partial<React.ComponentProps<typeof SubmissionCard>> = {}) =>
        render(
            <SubmissionCard
                ticketId="ticket-1"
                submission={mockSubmission}
                canRetry={false}
                isRetrying={false}
                onRetry={vi.fn()}
                onSettled={vi.fn()}
                {...props}
            />
        );

    it('renders the evaluation view by default', () => {
        renderSubmission();

        expect(screen.getByText('Attempt 1 — First review: feedback only, not scored')).toBeInTheDocument();
        expect(screen.getByText('Great job on the implementation!')).toBeInTheDocument();
        expect(screen.getByText('Not scored')).toBeInTheDocument();
    });

    it('loads and renders the diff when requested', () => {
        renderSubmission();

        fireEvent.click(screen.getByRole('button', { name: 'View diff' }));
        expect(screen.getByRole('region', { name: 'Diff' })).toBeInTheDocument();
        expect(screen.getByText('+console.log("Hello World");')).toBeInTheDocument();
    });
});