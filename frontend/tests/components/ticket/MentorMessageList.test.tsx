import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MentorMessageList, { type PendingMentorMessage } from '@/components/ticket/MentorMessageList';
import type { MentorMessage } from '@/types';

const messages: MentorMessage[] = [
  { id: 'message-1', role: 'user', content: 'Please review this change.', createdAt: '2026-09-01T00:00:00Z' },
  { id: 'message-2', role: 'mentor', content: 'Start by checking the edge case.', createdAt: '2026-09-01T00:01:00Z' },
];

describe('MentorMessageList (FE-088)', () => {
  it('renders the transcript in a polite log with speaker labels', () => {
    render(<MentorMessageList messages={messages} pending={null} canRetry={false} onRetry={vi.fn()} />);

    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveTextContent('You');
    expect(log).toHaveTextContent('Mentor');
    expect(log).toHaveTextContent('Start by checking the edge case.');
  });

  it('renders mentor content as plain text and preserves whitespace', () => {
    render(
      <MentorMessageList
        messages={[{ ...messages[1], content: '<img src=x>\nplain text' }]}
        pending={null}
        canRetry={false}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText(/<img src=x>/)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows a pending status while a mentor reply is sending', () => {
    const pending: PendingMentorMessage = {
      content: 'Help me inspect the branch.',
      status: 'sending',
      baseCount: messages.length,
      error: null,
    };
    render(<MentorMessageList messages={messages} pending={pending} canRetry={false} onRetry={vi.fn()} />);

    expect(screen.getByText('Mentor is thinking…')).toBeInTheDocument();
    expect(screen.getByText('Help me inspect the branch.')).toBeInTheDocument();
  });

  it('offers retry for a failed pending message only when allowed', () => {
    const pending: PendingMentorMessage = {
      content: 'Try this again.',
      status: 'failed',
      baseCount: messages.length,
      error: {
        status: 0,
        kind: 'network',
        message: 'Network unavailable.',
        action: 'retry',
        isNotFound: false,
        isTimeout: false,
      },
    };
    const onRetry = vi.fn();
    const { rerender } = render(
      <MentorMessageList messages={messages} pending={pending} canRetry onRetry={onRetry} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(<MentorMessageList messages={messages} pending={pending} canRetry={false} onRetry={onRetry} />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});