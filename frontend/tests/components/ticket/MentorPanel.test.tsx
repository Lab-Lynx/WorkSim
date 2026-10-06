import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MentorPanel from '@/components/ticket/MentorPanel';

const mocks = vi.hoisted(() => ({
  useMessages: vi.fn(),
  useSend: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@/hooks/mentor/useMentorMessages', () => ({ useMentorMessages: mocks.useMessages }));
vi.mock('@/hooks/mentor/useSendMentorMessage', () => ({ useSendMentorMessage: mocks.useSend }));

describe('MentorPanel (FE-090)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMessages.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    mocks.useSend.mockReturnValue({ mutateAsync: mocks.send, isPending: false });
  });

  it('shows the not-started block reason and disables sending', () => {
    render(<MentorPanel ticketId="ticket-1" mentor="not_started" />);

    expect(screen.getByText('Start the ticket to use the mentor.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('hides the composer when mentor access is read-only', () => {
    render(<MentorPanel ticketId="ticket-1" mentor="read_only" />);

    expect(screen.queryByRole('textbox', { name: 'Message to the mentor' })).not.toBeInTheDocument();
  });

  it('shows a pending message while send is unresolved and sends trimmed content once', async () => {
    mocks.send.mockReturnValue(new Promise(() => {}));
    render(<MentorPanel ticketId="ticket-1" mentor="enabled" />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Message to the mentor' }), {
      target: { value: '  Check this branch.  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith({ content: 'Check this branch.' }));
    expect(screen.getByText('Mentor is thinking…')).toBeInTheDocument();
    expect(screen.getByText('Check this branch.')).toBeInTheDocument();
  });
});
