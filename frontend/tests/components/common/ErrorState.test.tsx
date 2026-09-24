import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorState from '@/components/common/ErrorState';

describe('ErrorState', () => {
  it('renders the provided error message without a retry action when onRetry is not provided', () => {
    const { container } = render(<ErrorState message="Failed to load section data" />);

    expect(screen.getByText('Failed to load section data')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    const alertElement = screen.getByRole('alert');
    expect(alertElement).toBeInTheDocument();
    expect(alertElement).toContainElement(screen.getByText('Failed to load section data'));
    expect(container.firstChild).toHaveClass('rounded-lg');
  });

  it('renders retry button with default "Try again" label when onRetry is provided and triggers callback on click', () => {
    const handleRetry = vi.fn();
    render(<ErrorState message="Network error occurred" onRetry={handleRetry} />);

    expect(screen.getByText('Network error occurred')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: 'Try again' });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders custom retryLabel when provided and triggers onRetry callback when clicked', () => {
    const handleRetry = vi.fn();
    render(
      <ErrorState
        message="Failed to fetch dashboard metrics"
        onRetry={handleRetry}
        retryLabel="Reload metrics"
      />
    );

    expect(screen.getByText('Failed to fetch dashboard metrics')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: 'Reload metrics' });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('remains an inline component that can be nested inside container cards or sections', () => {
    const { container } = render(
      <section data-testid="parent-section">
        <ErrorState message="Inline failure in card" />
      </section>
    );

    const section = screen.getByTestId('parent-section');
    expect(section).toContainElement(container.querySelector('[role="alert"]'));
  });
});
