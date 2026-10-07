import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GetTicketPanel from '@/components/ticket/GetTicketPanel';
import { ApiError } from '@/lib/api/errors';

const mutateAsync = vi.fn();

vi.mock('@/hooks/tickets/useAssignTicket', () => ({
  useAssignTicket: () => ({ mutateAsync, isPending: false }),
}));

const renderPanel = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/tickets']}>
        <Routes>
          <Route path="/tickets" element={<GetTicketPanel />} />
          <Route path="/tickets/:ticketId" element={<p>Ticket page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('GetTicketPanel', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
  });

  it('assigns a ticket and opens it', async () => {
    mutateAsync.mockResolvedValue({ id: 'ticket-1' });
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Get your next ticket' }));

    await waitFor(() => expect(screen.getByText('Ticket page')).toBeInTheDocument());
  });

  it('shows the server message and a billing link when a subscription is required', async () => {
    mutateAsync.mockRejectedValue(
      new ApiError(402, 'Free tickets used. Subscribe to continue', 'api'),
    );
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Get your next ticket' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Free tickets used');
    expect(screen.getByRole('link', { name: 'Go to billing' })).toHaveAttribute('href', '/billing');
  });
});
