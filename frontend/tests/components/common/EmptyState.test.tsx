import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EmptyState from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

describe('EmptyState', () => {
  it('renders the title heading/text', () => {
    render(<EmptyState title="No submissions yet" />);

    expect(screen.getByRole('heading', { name: 'No submissions yet' })).toBeInTheDocument();
    expect(screen.getByText('No submissions yet')).toBeInTheDocument();
  });

  it('renders the description text when provided', () => {
    render(
      <EmptyState
        title="No payments found"
        description="Push your work to your ticket branch, then submit."
      />
    );

    expect(screen.getByRole('heading', { name: 'No payments found' })).toBeInTheDocument();
    expect(
      screen.getByText('Push your work to your ticket branch, then submit.')
    ).toBeInTheDocument();
  });

  it('renders without description and children when not provided', () => {
    const { container } = render(<EmptyState title="Empty list" />);

    expect(screen.getByRole('heading', { name: 'Empty list' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('renders the children slot when supplied as an optional next action', () => {
    render(
      <EmptyState title="No active tickets">
        <Button variant="default">Create Ticket</Button>
      </EmptyState>
    );

    expect(screen.getByRole('heading', { name: 'No active tickets' })).toBeInTheDocument();
    const actionButton = screen.getByRole('button', { name: 'Create Ticket' });
    expect(actionButton).toBeInTheDocument();
  });

  it('remains an inline component that can be placed inside a card or section', () => {
    const { container } = render(
      <section data-testid="card-section">
        <EmptyState title="No items" description="Check back later." />
      </section>
    );

    const section = screen.getByTestId('card-section');
    const emptyStateElement = container.firstChild;
    expect(section).toContainElement(emptyStateElement as HTMLElement);
  });
});
