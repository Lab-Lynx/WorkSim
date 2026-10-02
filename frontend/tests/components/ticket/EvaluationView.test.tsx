import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EvaluationView from '@/components/ticket/EvaluationView';
import type { Evaluation } from '@/types';

const evaluation: Evaluation = {
  feedback: 'Great job handling edge cases and structuring your code clean!',
  scores: {
    requirementsMet: 100,
    correctnessTests: 90,
    codeQuality: 85,
    problemSolving: 95,
    total: 93,
  },
  createdAt: '2026-03-30T10:05:00Z',
};

describe('EvaluationView (FE-085)', () => {
  it('never renders scores for first-attempt feedback, even when scores are present', () => {
    render(<EvaluationView evaluation={evaluation} attempt={1} />);

    expect(screen.getByText(evaluation.feedback)).toBeInTheDocument();
    expect(screen.getByText('Not scored')).toBeInTheDocument();
    expect(screen.queryByText('Score Breakdown')).not.toBeInTheDocument();
  });

  it('renders the score breakdown for a final review', () => {
    render(<EvaluationView evaluation={evaluation} attempt={2} />);

    expect(screen.getByText(evaluation.feedback)).toBeInTheDocument();
    expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
    expect(screen.getByText('93')).toBeInTheDocument();
  });

  it('shows Score unavailable for a final review without scores', () => {
    render(<EvaluationView evaluation={{ ...evaluation, scores: null }} attempt={2} />);

    expect(screen.getByText('Score unavailable')).toBeInTheDocument();
  });

  it('renders feedback as plain text', () => {
    const feedback = '<img src=x onerror=alert(1)>';
    render(<EvaluationView evaluation={{ ...evaluation, feedback }} attempt={1} />);

    expect(screen.getByText(feedback)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});