import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import SubmissionsPanel from '@/components/ticket/SubmissionsPanel';
import type { Submission, SubmissionAttempt } from '@/types';
import type { TicketPhaseInfo } from '@/lib/ticket-phase';

vi.mock('@/components/ticket/SubmissionCard', () => ({
	default: ({
		submission,
		canRetry,
		isRetrying,
		onRetry,
	}: {
		submission: Submission;
		canRetry: boolean;
		isRetrying: boolean;
		onRetry: () => void;
	}) => (
		<div data-testid={`submission-attempt-${submission.attempt}`}>
			Attempt {submission.attempt}
			{canRetry && (
				<button type="button" disabled={isRetrying} onClick={onRetry}>
					{isRetrying ? 'Retrying…' : 'Retry review'}
				</button>
			)}
		</div>
	),
}));

const makeSubmission = (attempt: SubmissionAttempt): Submission => ({
	id: `submission-${attempt}`,
	attempt,
	status: 'failed',
	prNumber: 42,
	prUrl: 'https://github.com/example/repo/pull/42',
	headSha: 'abc123',
	ciPassed: false,
	ciRunUrl: null,
	failureReason: 'Review failed',
	submittedAt: '2026-09-29T18:00:00Z',
	evaluation: null,
});

const makePhase = (retryAttempt: SubmissionAttempt | null): TicketPhaseInfo => ({
	key: retryAttempt === 2 ? 'final_review_failed' : 'first_review_failed',
	label: 'Review failed',
	primaryAction: retryAttempt === null ? null : 'retry',
	retryAttempt,
	mentor: 'unavailable_after_submit',
	canAbandon: false,
	isProcessing: false,
	defaultTab: 'submissions',
});

function renderPanel(overrides: Partial<ComponentProps<typeof SubmissionsPanel>> = {}) {
	const props: ComponentProps<typeof SubmissionsPanel> = {
		ticketId: 'ticket-1',
		submissions: [makeSubmission(1), makeSubmission(2)],
		phase: makePhase(null),
		hasAccess: true,
		retryingAttempt: null,
		onRetry: vi.fn(),
		onSettled: vi.fn(),
		...overrides,
	};

	return { ...render(<SubmissionsPanel {...props} />), props };
}

describe('SubmissionsPanel', () => {
	it('renders submissions in attempt order', () => {
		renderPanel({ submissions: [makeSubmission(2), makeSubmission(1)] });

		expect(screen.getAllByTestId(/submission-attempt-/).map((card) => card.dataset.testid)).toEqual([
			'submission-attempt-1',
			'submission-attempt-2',
		]);
	});

	it('shows the specified empty state when there are no submissions', () => {
		renderPanel({ submissions: [] });

		expect(screen.getByText('No submissions yet.')).toBeInTheDocument();
		expect(screen.getByText('Push your work to your ticket branch, then submit.')).toBeInTheDocument();
	});

	it('allows retry only for the phase attempt when access is active', () => {
		const { props } = renderPanel({ phase: makePhase(1) });
		const retryButton = screen.getByRole('button', { name: 'Retry review' });

		expect(retryButton).toBeEnabled();
		fireEvent.click(retryButton);
		expect(props.onRetry).toHaveBeenCalledWith(1);
	});

	it('does not offer retry when access is inactive or the phase attempt does not match', () => {
		const { rerender } = renderPanel({ phase: makePhase(1), hasAccess: false });
		expect(screen.queryByRole('button', { name: 'Retry review' })).not.toBeInTheDocument();
		const retryAttemptTwo = vi.fn();

		rerender(
			<SubmissionsPanel
				ticketId="ticket-1"
				submissions={[makeSubmission(1), makeSubmission(2)]}
				phase={makePhase(2)}
				hasAccess
				retryingAttempt={null}
				onRetry={retryAttemptTwo}
				onSettled={vi.fn()}
			/>
		);

		const retryButton = screen.getByRole('button', { name: 'Retry review' });
		expect(retryButton).toBeEnabled();
		expect(screen.getByTestId('submission-attempt-1')).toBeInTheDocument();
		fireEvent.click(retryButton);
		expect(retryAttemptTwo).toHaveBeenCalledWith(2);
	});

	it('disables retry while that attempt is being retried', () => {
		renderPanel({ phase: makePhase(2), retryingAttempt: 2 });

		expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled();
	});
});
