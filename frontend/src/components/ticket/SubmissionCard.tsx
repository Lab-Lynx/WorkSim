import * as React from 'react';
import type { Submission } from '@/types';
import EvaluationView from '@/components/ticket/EvaluationView';
import { DiffViewer, type FileDiff } from '@/components/ticket/DiffViewer';
import { cn } from '@/lib/utils';

export interface SubmissionCardProps {
    submission: Submission;
    className?: string;
}

export function SubmissionCard({ submission, className }: SubmissionCardProps): React.JSX.Element {
    const [activeTab, setActiveTab] = React.useState<'evaluation' | 'diff'>('evaluation');

    // Parse or map submission.diff into FileDiff[] format required by DiffViewer
    const diffs: FileDiff[] = React.useMemo(() => {
        if (!submission.diff) return [];
        return [
            {
                filename: 'changes.patch',
                additions: 0,
                deletions: 0,
                patch: submission.diff,
            },
        ];
    }, [submission.diff]);

    return (
        <div className={cn('space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm', className)}>
            {/* Header Tabs Navigation */}
            <div className="flex border-b border-border">
                <button
                    type="button"
                    onClick={() => setActiveTab('evaluation')}
                    className={cn(
                        'px-4 py-2 font-medium text-sm transition-colors border-b-2 -mb-px',
                        activeTab === 'evaluation'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                    aria-selected={activeTab === 'evaluation'}
                    role="tab"
                >
                    Evaluation
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('diff')}
                    className={cn(
                        'px-4 py-2 font-medium text-sm transition-colors border-b-2 -mb-px',
                        activeTab === 'diff'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                    aria-selected={activeTab === 'diff'}
                    role="tab"
                >
                    Diff Changes
                </button>
            </div>

            {/* Tab Content Display */}
            <div className="pt-2">
                {activeTab === 'evaluation' ? (
                    <EvaluationView submission={submission} />
                ) : (
                    <DiffViewer diffs={diffs} />
                )}
            </div>
        </div>
    );
}

export default SubmissionCard;