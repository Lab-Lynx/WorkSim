import * as React from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';
import type { Submission } from '@/types';
import StatusBadge from '@/components/common/StatusBadge';
import { ScoreBreakdown } from '@/components/ticket/ScoreBreakdown';
import { cn } from '@/lib/utils';

export interface EvaluationViewProps {
    submission: Submission;
    className?: string;
}

export function EvaluationView({ submission, className }: EvaluationViewProps): React.JSX.Element {
    const { attempt, status, prNumber, prUrl, ciPassed, ciRunUrl, failureReason, evaluation } = submission;

    const titleText = attempt === 1 ? 'Attempt 1 Evaluation' : 'Attempt 2 Evaluation';

    return (
        <section
            aria-label={titleText}
            className={cn('space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm', className)}
        >
            {/* Header section */}
            <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold tracking-tight text-foreground">{titleText}</h2>
                        <StatusBadge domain="submission" status={status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Submitted for pull request{' '}
                        <a
                            href={prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                            #{prNumber}
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        </a>
                    </p>
                </div>

                {/* Continuous Integration Status */}
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-muted-foreground">CI Status:</span>
                    <StatusBadge domain="ci" passed={ciPassed} />
                    {ciRunUrl && (
                        <a
                            href={ciRunUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            aria-label="View CI run details"
                        >
                            Logs
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </a>
                    )}
                </div>
            </div>

            {/* Submission Failure or Evaluation Content */}
            {status === 'failed' || failureReason ? (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
                >
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold">Evaluation Failed</h3>
                        <p className="text-sm text-foreground">
                            {failureReason || 'An unexpected error occurred during evaluation. Please try again or contact support.'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Feedback Text Section */}
                    {evaluation?.feedback && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Mentor Feedback
                            </h3>
                            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm leading-relaxed text-foreground whitespace-pre-line">
                                {evaluation.feedback}
                            </div>
                        </div>
                    )}

                    {/* Numerical Scores Breakdown */}
                    {evaluation?.scores ? (
                        <ScoreBreakdown scores={evaluation.scores} />
                    ) : (
                        status === 'completed' && (
                            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                                No score breakdown available for this evaluation.
                            </div>
                        )
                    )}
                </div>
            )}
        </section>
    );
}

export default EvaluationView;