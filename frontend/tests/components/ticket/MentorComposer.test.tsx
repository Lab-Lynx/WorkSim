import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MentorComposer from '@/components/ticket/MentorComposer';

describe('MentorComposer (FE-089)', () => {
  it('trims and sends only from the button, then clears the textarea', () => {
    const onSend = vi.fn();
    render(<MentorComposer disabledReason={null} isSending={false} maxChars={null} onSend={onSend} />);

    const textarea = screen.getByRole('textbox', { name: 'Message to the mentor' });
    fireEvent.change(textarea, { target: { value: '  Please explain this edge case.  ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('Please explain this edge case.');
    expect(textarea).toHaveValue('');
  });

  it('disables send for empty, pending, disabled-reason, and over-limit states', () => {
    const onSend = vi.fn();
    const { rerender } = render(
      <MentorComposer disabledReason={null} isSending={false} maxChars={4} onSend={onSend} />
    );
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    const textarea = screen.getByRole('textbox', { name: 'Message to the mentor' });
    fireEvent.change(textarea, { target: { value: '12345' } });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    rerender(<MentorComposer disabledReason="Ticket is read-only." isSending={false} maxChars={null} onSend={onSend} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByText('Ticket is read-only.')).toBeInTheDocument();
    expect(textarea).toHaveAttribute('aria-describedby');

    rerender(<MentorComposer disabledReason={null} isSending maxChars={null} onSend={onSend} />);
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
  });

  it('shows a character counter only when the limit is known', () => {
    const { rerender } = render(
      <MentorComposer disabledReason={null} isSending={false} maxChars={20} onSend={vi.fn()} />
    );
    expect(screen.getByText('0 / 20')).toBeInTheDocument();

    rerender(<MentorComposer disabledReason={null} isSending={false} maxChars={null} onSend={vi.fn()} />);
    expect(screen.queryByText(/\/\s*\d+/)).not.toBeInTheDocument();
  });
});