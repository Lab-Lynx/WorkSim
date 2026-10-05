import { Link } from 'react-router-dom';
import SubmitButton from '@/components/common/SubmitButton';
import type { UiError } from '@/lib/api/errors';
import type { TicketPhaseInfo, TicketPrimaryAction } from '@/lib/ticket-phase';

export interface TicketActionBarProps {
	phase: TicketPhaseInfo;
	hasAccess: boolean;
	pendingAction: TicketPrimaryAction | null;
	error: UiError | null;
	onAction: (action: TicketPrimaryAction) => void;
}

const actionCopy: Record<TicketPrimaryAction, { label: string; pending: string }> = {
	start: { label: 'Start working', pending: 'Starting…' },
	submit: { label: 'Submit for feedback', pending: 'Submitting…' },
	resubmit: { label: 'Resubmit for final score', pending: 'Submitting…' },
	retry: { label: 'Retry review', pending: 'Retrying…' },
	get_next: { label: 'Get next ticket', pending: 'Getting your ticket…' },
};

const phaseCopy: Record<TicketPhaseInfo['key'], string> = {
	ready_to_start: 'Start this ticket when you are ready to work.',
	in_progress: 'Make the requested changes, then submit your work for feedback.',
	first_review_processing: 'Your first review is in progress.',
	feedback_ready: 'Review the feedback and revise your work for a final score.',
	first_review_failed: 'The first review failed. Retry it when you are ready.',
	final_review_processing: 'Your final review is in progress.',
	final_review_failed: 'The final review failed. Retry it when you are ready.',
	final_review_finalizing: 'Your final review is complete. Finalizing this ticket.',
	done: 'This ticket is complete.',
	abandoned: 'This ticket was abandoned.',
};

export default function TicketActionBar({
	phase,
	hasAccess,
	pendingAction,
	error,
	onAction,
}: TicketActionBarProps): React.JSX.Element {
	const action = phase.primaryAction;
	const copy = action ? actionCopy[action] : null;
	const isPending = action !== null && pendingAction === action;

	return (
		<section aria-label="Ticket action" className="space-y-3 border-y border-border py-4">
			{phase.isProcessing ? (
				<p role="status" className="text-sm text-muted-foreground">{phaseCopy[phase.key]}</p>
			) : (
				<p className="text-sm text-foreground">{phaseCopy[phase.key]}</p>
			)}

			{action && copy && (
				<div className="flex flex-wrap items-center gap-3">
					<SubmitButton
						type="button"
						isPending={isPending}
						pendingLabel={copy.pending}
						disabled={!hasAccess || (pendingAction !== null && !isPending)}
						onClick={() => onAction(action)}
					>
						{copy.label}
					</SubmitButton>
					{!hasAccess && (
						<p className="text-sm text-muted-foreground">
							An active subscription is required.{' '}
							<Link to="/billing" className="font-medium text-primary underline">Go to billing</Link>
						</p>
					)}
					{action === 'submit' && (
						<p className="basis-full text-xs text-muted-foreground">
							Your first submission gets feedback only, no score. You can then revise and resubmit once for your final score.
						</p>
					)}
				</div>
			)}

			{error && (
				<div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
					<span>{error.message}</span>
					{error.action === 'go_billing' && (
						<Link to="/billing" className="ml-2 font-medium underline">Go to billing</Link>
					)}
					{error.action === 'reconnect_github' && (
						<Link to="/github" className="ml-2 font-medium underline">Reconnect GitHub</Link>
					)}
				</div>
			)}
		</section>
	);
}
