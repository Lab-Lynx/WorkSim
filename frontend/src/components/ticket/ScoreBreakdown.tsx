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
      <div className="border-b border-border pb-3">
        <h3 className="text-lg font-semibold">Score Breakdown</h3>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_160px]">
        <div className="flex flex-col justify-center space-y-4">
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
                    className="relative h-full rounded-full bg-gradient-to-r from-orange-400/80 to-orange-600/80 transition-all duration-300 overflow-hidden"
                    style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
                    aria-valuenow={score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    role="progressbar"
                    aria-label={label}
                  >
                    <div className="absolute inset-0 opacity-20 bg-[image:linear-gradient(45deg,rgba(255,255,255,1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,1)_50%,rgba(255,255,255,1)_75%,transparent_75%,transparent)] bg-[length:12px_12px]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/30 p-5 text-center">
          <span className="mb-4 text-sm font-medium text-muted-foreground">Total Score</span>
          <div className="relative flex size-24 items-center justify-center">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <defs>
                <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#fb923c" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ea580c" stopOpacity="0.8" />
                </linearGradient>
              </defs>
              <path
                className="text-muted"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="url(#score-gradient)"
                strokeWidth="2.5"
                strokeDasharray={`${Math.min(Math.max(scores.total ?? 0, 0), 100)}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{formatScore(scores.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ScoreBreakdown;
