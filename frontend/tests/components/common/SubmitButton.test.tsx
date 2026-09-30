import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SubmitButton from '@/components/common/SubmitButton';

describe('SubmitButton', () => {
  it('defaults type to "submit" and respects explicit type', () => {
    const { rerender } = render(
      <SubmitButton isPending={false} pendingLabel="Submitting...">
        Submit Form
      </SubmitButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');

    rerender(
      <SubmitButton type="button" isPending={false} pendingLabel="Submitting...">
        Submit Form
      </SubmitButton>
    );
    expect(button).toHaveAttribute('type', 'button');
  });

  it('renders children when not pending', () => {
    render(
      <SubmitButton isPending={false} pendingLabel="Submitting...">
        Submit Form
      </SubmitButton>
    );

    expect(screen.getByText('Submit Form')).toBeInTheDocument();
    expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).not.toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false');
  });

  it('disables button, displays pendingLabel, sets aria-busy="true", and hides spinner from screen readers when pending', () => {
    const handleClick = vi.fn();
    render(
      <SubmitButton isPending={true} pendingLabel="Saving..." onClick={handleClick}>
        Save Changes
      </SubmitButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();

    // Verify double-submit prevention
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();

    // Verify spinner element with aria-hidden="true"
    const spinner = button.querySelector('svg');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });

  it('preserves explicit disabled prop when not pending', () => {
    render(
      <SubmitButton disabled={true} isPending={false} pendingLabel="Saving...">
        Save Changes
      </SubmitButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('forwards optional variant and className props', () => {
    render(
      <SubmitButton
        variant="outline"
        className="my-custom-btn"
        isPending={false}
        pendingLabel="Saving..."
      >
        Save Changes
      </SubmitButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('my-custom-btn');
  });
});
