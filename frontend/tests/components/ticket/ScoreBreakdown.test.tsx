import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreBreakdown } from '@/components/ticket/ScoreBreakdown';
import { RUBRIC_CATEGORIES } from '@/config/rubric';
import { formatScore } from '@/lib/format';
import type { EvaluationScores } from '@/types';

const mockScores: EvaluationScores = {
    requirementsMet: 90,
    correctnessTests: 80,
    codeQuality: 85,
    problemSolving: 70,
    total: 83,
};

describe('ScoreBreakdown Component', () => {
    it('renders the overall total score', () => {
        render(<ScoreBreakdown scores={mockScores} />);

        expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
        expect(screen.getByText('83')).toBeInTheDocument();
        expect(screen.getByText('/ 100')).toBeInTheDocument();
    });

    it('renders all categories from RUBRIC_CATEGORIES with scores and weightings', () => {
        render(<ScoreBreakdown scores={mockScores} />);

        RUBRIC_CATEGORIES.forEach(({ key, label, weightPercent }) => {
            expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
            expect(screen.getByText(`(${weightPercent}%)`)).toBeInTheDocument();
            expect(screen.getByText(`${formatScore(mockScores[key])} / 100`)).toBeInTheDocument();
        });
    });

    it('renders progress bars with correct ARIA attributes', () => {
        render(<ScoreBreakdown scores={mockScores} />);

        RUBRIC_CATEGORIES.forEach(({ key, label }) => {
            const progressBar = screen.getByRole('progressbar', { name: label });
            expect(progressBar).toBeInTheDocument();
            expect(progressBar).toHaveAttribute('aria-valuenow', String(mockScores[key]));
        });
    });

    it('formats displayed scores and clamps only the visual bar width', () => {
        const outOfRangeScores: EvaluationScores = {
            requirementsMet: 120.25,
            correctnessTests: -10.25,
            codeQuality: 85,
            problemSolving: 70,
            total: 110.25,
        };
        const { container } = render(<ScoreBreakdown scores={outOfRangeScores} />);

        expect(screen.getByText('110.3')).toBeInTheDocument();
        expect(screen.getByText('120.3 / 100')).toBeInTheDocument();
        expect(screen.getByText('-10.3 / 100')).toBeInTheDocument();
        const progressBars = screen.getAllByRole('progressbar');
        expect(progressBars[0]).toHaveStyle({ width: '100%' });
        expect(progressBars[1]).toHaveStyle({ width: '0%' });
        expect(container).toBeInTheDocument();
    });

    it('applies custom className if provided', () => {
        const { container } = render(
            <ScoreBreakdown scores={mockScores} className="custom-class" />
        );

        expect(container.firstChild).toHaveClass('custom-class');
    });
});