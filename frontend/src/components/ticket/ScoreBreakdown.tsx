import React from 'react';
import type { EvaluationScores } from '@/types';
import { RUBRIC_CATEGORIES } from '@/config/rubric';

interface ScoreBreakdownProps {
    scores: EvaluationScores;
    className?: string;
}

export const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({ scores, className = '' }) => {
    return (
        <div className={`space-y-4 rounded-lg border border-border bg-surface p-4 shadow-sm ${className}`}>
            <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-semibold text-text-heading">Score Breakdown</h3>
                <div className="text-right">
                    <span className="text-2xl font-bold text-primary">{scores.total}</span>
                    <span className="text-sm text-text-muted"> / 100</span>
                </div>
            </div>

            <div className="space-y-3">
                {RUBRIC_CATEGORIES.map(({ key, label, weightPercent }) => {
                    const score = scores[key] ?? 0;

                    return (
                        <div key={key} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-text-body">
                                    {label} <span className="text-xs text-text-muted">({weightPercent}%)</span>
                                </span>
                                <span className="font-semibold text-text-heading">{score}%</span>
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
        </div>
    );
};