import type { Evaluation, SubmissionAttempt } from '@/types';
import { ScoreBreakdown } from '@/components/ticket/ScoreBreakdown';

export interface EvaluationViewProps {
    evaluation: Evaluation;
    attempt: SubmissionAttempt;
}

export function EvaluationView({ evaluation, attempt }: EvaluationViewProps): React.JSX.Element {
    return (
        <section aria-label={`Attempt ${attempt} evaluation`} className="space-y-4">
            <div className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {evaluation.feedback}
            </div>
            {attempt === 1 ? (
                <p className="text-sm font-medium text-muted-foreground">Not scored</p>
            ) : evaluation.scores ? (
                <ScoreBreakdown scores={evaluation.scores} />
            ) : (
                <p className="text-sm text-muted-foreground">Score unavailable</p>
            )}
        </section>
    );
}

export default EvaluationView;