import { useEffect, useRef, useState } from 'react';
import type { Submission } from '@/types';
import { useSubmission } from '@/hooks/submissions/useSubmission';
import { formatDateTime } from '@/lib/format';
import StatusBadge from '@/components/common/StatusBadge';
import { ExternalLink } from '@/components/common/ExternalLink';
import ErrorState from '@/components/common/ErrorState';
import SubmitButton from '@/components/common/SubmitButton';
import EvaluationView from '@/components/ticket/EvaluationView';
import DiffViewer from '@/components/ticket/DiffViewer';

export interface SubmissionCardProps {
    ticketId: string;
    submission: Submission;
    canRetry: boolean;
    isRetrying: boolean;
    onRetry: () => void;
    onSettled: () => void;
}

export function SubmissionCard({
    ticketId,
    submission,
    canRetry,
    isRetrying,
    onRetry,
    onSettled,
}: SubmissionCardProps): React.JSX.Element {
    const [diffOpen, setDiffOpen] = useState(false);
    const settledRef = useRef<string | null>(null);
    const isProcessing = submission.status === 'awaiting_ci' || submission.status === 'evaluating';
    const polling = useSubmission(ticketId, submission.attempt, { enabled: isProcessing });
    const diffQuery = useSubmission(ticketId, submission.attempt, {
        includeDiff: true,
        enabled: diffOpen,
    });
    const currentSubmission = polling.query.data ?? submission;

    useEffect(() => {
        const polled = polling.query.data;
        if (!polled || (polled.status !== 'completed' && polled.status !== 'failed')) return;
        if (settledRef.current === polled.id) return;
        settledRef.current = polled.id;
        onSettled();
    }, [polling.query.data, onSettled]);

    const attemptTitle = currentSubmission.attempt === 1
        ? 'Attempt 1 — First review: feedback only, not scored'
        : 'Attempt 2 — Final review';

    return (
        <article className="space-y-4 border-b border-border py-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-foreground">{attemptTitle}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Submitted {formatDateTime(currentSubmission.submittedAt)}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge domain="submission" status={currentSubmission.status} />
                    <StatusBadge domain="ci" passed={currentSubmission.ciPassed} />
                </div>
            </header>

            <div className="flex flex-wrap gap-4 text-sm">
                <ExternalLink href={currentSubmission.prUrl}>Pull request #{currentSubmission.prNumber}</ExternalLink>
                {currentSubmission.ciRunUrl && <ExternalLink href={currentSubmission.ciRunUrl}>CI run</ExternalLink>}
            </div>

            {currentSubmission.status === 'awaiting_ci' && (
                <div role="status" className="space-y-2 text-sm text-muted-foreground">
                    <p>Waiting for GitHub Actions to run your tests.</p>
                    {polling.showSlowHint && <p>This is taking longer than usual. You can leave this page; your submission is not lost.</p>}
                </div>
            )}
            {currentSubmission.status === 'evaluating' && (
                <div role="status" className="space-y-2 text-sm text-muted-foreground">
                    <p>The evaluator is reviewing your code and test results.</p>
                    {polling.showSlowHint && <p>This is taking longer than usual. You can leave this page; your submission is not lost.</p>}
                </div>
            )}
            {polling.pollingStopped && (
                <button type="button" className="text-sm font-medium text-primary underline" onClick={polling.restartPolling}>
                    Check again
                </button>
            )}
            {polling.query.isError && <ErrorState message="Could not refresh this submission." onRetry={polling.restartPolling} />}
            {currentSubmission.failureReason && (
                <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {currentSubmission.failureReason}
                </div>
            )}
            {currentSubmission.status === 'failed' && canRetry && (
                <SubmitButton
                    type="button"
                    isPending={isRetrying}
                    pendingLabel="Retrying…"
                    onClick={onRetry}
                >
                    Retry review
                </SubmitButton>
            )}
            {currentSubmission.status === 'completed' && currentSubmission.evaluation && (
                <EvaluationView evaluation={currentSubmission.evaluation} attempt={currentSubmission.attempt} />
            )}

            {(currentSubmission.status === 'completed' || currentSubmission.status === 'failed') && (
                <div>
                    <button
                        type="button"
                        aria-expanded={diffOpen}
                        onClick={() => setDiffOpen((open) => !open)}
                        className="text-sm font-medium text-primary underline"
                    >
                        {diffOpen ? 'Hide diff' : 'View diff'}
                    </button>
                    {diffOpen && (
                        <div className="mt-3">
                            {diffQuery.query.isLoading ? (
                                <div role="status" aria-label="Loading diff" className="h-24 animate-pulse bg-muted" />
                            ) : diffQuery.query.isError ? (
                                <ErrorState message="Could not load this diff." onRetry={() => void diffQuery.query.refetch()} />
                            ) : (
                                <DiffViewer diff={diffQuery.query.data?.diff ?? currentSubmission.diff ?? ''} />
                            )}
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}

export default SubmissionCard;