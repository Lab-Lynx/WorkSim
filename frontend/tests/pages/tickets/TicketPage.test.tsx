import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TicketPage from '@/pages/tickets/TicketPage';
import { ApiError } from '@/lib/api/errors';
import type { Ticket } from '@/types';

const mocks = vi.hoisted(() => ({
  useTicket: vi.fn(),
  useSubscription: vi.fn(),
  useStartTicket: vi.fn(),
  useAbandonTicket: vi.fn(),
  useAssignTicket: vi.fn(),
  useSubmitWork: vi.fn(),
  useRetrySubmission: vi.fn(),
  useToast: vi.fn(),
  start: vi.fn(),
  abandon: vi.fn(),
  assign: vi.fn(),
  submit: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('@/hooks/tickets/useTicket', () => ({ useTicket: mocks.useTicket }));
vi.mock('@/hooks/billing/useSubscription', () => ({ useSubscription: mocks.useSubscription }));
vi.mock('@/hooks/tickets/useStartTicket', () => ({ useStartTicket: mocks.useStartTicket }));
vi.mock('@/hooks/tickets/useAbandonTicket', () => ({ useAbandonTicket: mocks.useAbandonTicket }));
vi.mock('@/hooks/tickets/useAssignTicket', () => ({ useAssignTicket: mocks.useAssignTicket }));
vi.mock('@/hooks/submissions/useSubmitWork', () => ({ useSubmitWork: mocks.useSubmitWork }));
vi.mock('@/hooks/submissions/useRetrySubmission', () => ({ useRetrySubmission: mocks.useRetrySubmission }));
vi.mock('@/hooks/useToast', () => ({ useToast: mocks.useToast }));

const ticket: Ticket = {
  id: 'ticket-1', status: 'assigned', templateKey: 'react', title: 'Improve settings validation',
  scenario: 'Add validation.', category: 'Frontend', difficulty: 'Intermediate', touchedFiles: [],
  acceptanceCriteria: [], testChecklist: [], branchName: 'feat/settings',
  repo: { fullName: 'student/worksim', defaultBranch: 'main' }, createdAt: '2026-09-01T00:00:00Z',
  completedAt: null, abandonedAt: null,
};

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tickets/ticket-1']}>
        <Routes>
          <Route path="/tickets/:ticketId" element={<><TicketPage /><LocationDisplay /></>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TicketPage (FE-095)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useTicket.mockReturnValue({
      data: { ticket, submissions: [] }, status: 'success', isPending: false, isError: false,
      error: null, refetch: vi.fn(),
    });
    mocks.useSubscription.mockReturnValue({ data: { subscription: null, hasAccess: true }, isLoading: false });
    mocks.useStartTicket.mockReturnValue({ mutateAsync: mocks.start, isPending: false });
    mocks.useAbandonTicket.mockReturnValue({ mutateAsync: mocks.abandon, isPending: false });
    mocks.useAssignTicket.mockReturnValue({ mutateAsync: mocks.assign, isPending: false });
    mocks.useSubmitWork.mockReturnValue({ mutateAsync: mocks.submit, isPending: false });
    mocks.useRetrySubmission.mockReturnValue({ mutateAsync: mocks.retry, isPending: false });
    mocks.useToast.mockReturnValue({ toast: { success: vi.fn(), error: vi.fn() } });
  });

  it('renders the ticket title and phase action, then starts the ticket through its hook', async () => {
    mocks.start.mockResolvedValue(ticket);
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: ticket.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start working' }));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
  });

  it('shows the same not-found state for a 404 and does not reveal ticket data', () => {
    mocks.useTicket.mockReturnValue({
      data: undefined, status: 'error', isPending: false, isError: true,
      error: new ApiError(404, 'Not found', 'api'), refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByText('Ticket not found')).toBeInTheDocument();
    expect(screen.queryByText(ticket.title)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
  });

  it('submits work and switches to the submissions tab', async () => {
    mocks.useTicket.mockReturnValue({
      data: { ticket: { ...ticket, status: 'in_progress' }, submissions: [] },
      status: 'success', isPending: false, isError: false, error: null, refetch: vi.fn(),
    });
    mocks.submit.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Submit for feedback' }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?tab=submissions'));
  });
});