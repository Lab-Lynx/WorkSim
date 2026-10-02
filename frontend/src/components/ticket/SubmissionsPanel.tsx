import type { Submission, SubmissionAttempt } from '@/types';
import type { TicketPhaseInfo } from '@/lib/ticket-phase';
import EmptyState from '@/components/common/EmptyState';
import SubmissionCard from '@/components/ticket/SubmissionCard';

export interface SubmissionsPanelProps {
	ticketId: string;
	submissions: Submission[];
	phase: TicketPhaseInfo;
	hasAccess: boolean;
	retryingAttempt: SubmissionAttempt | null;
	onRetry: (attempt: SubmissionAttempt) => void;
	onSettled: () => void;
}

export function SubmissionsPanel(props: SubmissionsPanelProps) {
	const { submissions, phase, hasAccess, retryingAttempt, onRetry } = props;

	if (submissions.length === 0) {
		return (
			<EmptyState
				title="No submissions yet."
				description="Push your work to your ticket branch, then submit."
			/>
		);
	}

	const orderedSubmissions = [...submissions].sort((first, second) => first.attempt - second.attempt);

	return (
		<section aria-label="Submissions" className="space-y-6">
			{orderedSubmissions.map((submission) => {
				const canRetry = phase.retryAttempt === submission.attempt && hasAccess;
				const isRetrying = retryingAttempt === submission.attempt;

				return (
					<div key={submission.id} className="space-y-3">
						<SubmissionCard
							ticketId={props.ticketId}
							submission={submission}
							canRetry={canRetry}
							isRetrying={isRetrying}
							onRetry={() => onRetry(submission.attempt)}
							onSettled={props.onSettled}
						/>
					</div>
				);
			})}
		</section>
	);
}

export default SubmissionsPanel;
