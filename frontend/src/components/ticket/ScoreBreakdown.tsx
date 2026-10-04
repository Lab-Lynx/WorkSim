import type { EvaluationScores } from '@/types';
import { RUBRIC_CATEGORIES } from '@/config/rubric';
import { formatScore } from '@/lib/format';

export interface ScoreBreakdownProps {
  scores: EvaluationScores;
  className?: string;
}

export function ScoreBreakdown({ scores, className }: ScoreBreakdownProps) {
  return (
    <section className={`space-y-4 rounded-lg border border-border bg-card p-4 ${className ?? ''}`} aria-label="Score breakdown">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-lg font-semibold">Score Breakdown</h3>
        <div className="text-right">
          <span className="text-2xl font-bold text-primary">{formatScore(scores.total)}</span>
          <span className="text-sm text-muted-foreground"> / 100</span>
        </div>
      </div>

      <div className="space-y-3">
        {RUBRIC_CATEGORIES.map(({ key, label, weightPercent }) => {
          const score = scores[key] ?? 0;

          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {label} <span className="text-xs text-muted-foreground">({weightPercent}%)</span>
                </span>
                <span className="font-semibold">{formatScore(score)} / 100</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
                  aria-valuenow={score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  role="progressbar"
                  aria-label={label}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ScoreBreakdown;
