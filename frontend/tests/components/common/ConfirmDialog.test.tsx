import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Are you sure?',
    description: 'This action cannot be undone.',
    confirmLabel: 'Confirm Action',
    cancelLabel: 'Cancel Action',
    onConfirm: vi.fn(),
    isPending: false,
    errorMessage: null,
    destructive: false,
  };

  it('renders correctly when open is true', () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Are you sure?' })).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Action' })).toBeInTheDocument();
  });

  it('calls preventDefault() and onConfirm() on confirmation without closing itself', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        {...defaultProps}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />
    );

    const confirmButton = screen.getByRole('button', { name: 'Confirm Action' });

    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Are you sure?' })).toBeInTheDocument();
  });

  it('prevents interactions and keeps dialog open when isPending is true', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        {...defaultProps}
        isPending={true}
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
      />
    );

    const confirmButton = screen.getByRole('button', { name: 'Confirm Action' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel Action' });

    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();

    // Verify confirmLabel accessible name is preserved
    expect(confirmButton).toHaveTextContent('Confirm Action');

    // Simulate Escape key press
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();

    expect(screen.getByRole('heading', { name: 'Are you sure?' })).toBeInTheDocument();
  });

  it('blocks outside click interaction when isPending is true', () => {
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        {...defaultProps}
        isPending={true}
        onOpenChange={onOpenChange}
      />
    );

    // Simulate pointer down outside dialog overlay
    fireEvent.pointerDown(document.body);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('renders error message accessibly without closing the dialog', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        errorMessage="Failed to complete action. Please try again."
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Failed to complete action. Please try again.');
    expect(screen.getByRole('heading', { name: 'Are you sure?' })).toBeInTheDocument();
  });

  it('handles cancel button click through onOpenChange when not pending', () => {
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel Action' });
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});