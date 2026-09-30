import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SetupChecklist from '@/components/dashboard/SetupChecklist';
import type { SetupProgress } from '@/hooks/useSetupProgress';

const progress: SetupProgress = {
  steps: [
    { key: 'subscribe', status: 'todo', label: 'Subscribe', detail: null },
    { key: 'connect_github', status: 'todo', label: 'Connect GitHub', detail: null },
    { key: 'create_repo', status: 'todo', label: 'Create repository', detail: null },
    { key: 'get_ticket', status: 'todo', label: 'Get a ticket', detail: null },
  ],
  nextStep: 'subscribe',
  setupComplete: false,
  canGetTicket: false,
};

describe('SetupChecklist (FE-080)', () => {
  it('renders all steps and links only the next setup action', () => {
    render(
      <MemoryRouter>
        <SetupChecklist progress={progress} onRetry={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getAllByText('Subscribe')).toHaveLength(2);
    expect(screen.getByText('Connect GitHub')).toBeInTheDocument();
    expect(screen.getByText('Create repository')).toBeInTheDocument();
    expect(screen.getByText('Get a ticket')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /subscribe/i })).toHaveAttribute('href', '/billing');
    expect(screen.queryByRole('button', { name: /get.*ticket/i })).not.toBeInTheDocument();
  });

  it('collapses to a summary when the first three setup steps are complete', () => {
    render(
      <MemoryRouter>
        <SetupChecklist
          progress={{ ...progress, setupComplete: true, nextStep: 'get_ticket' }}
          onRetry={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByText('Setup complete: subscribed, GitHub connected, repository ready.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Get a ticket')).not.toBeInTheDocument();
  });

  it('renders a retry action for a step in error', () => {
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <SetupChecklist
          progress={{
            ...progress,
            steps: progress.steps.map((step) =>
              step.key === 'connect_github' ? { ...step, status: 'error' } : step
            ),
            nextStep: null,
          }}
          onRetry={onRetry}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});