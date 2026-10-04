import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import { queryKeys } from '@/lib/query-keys';
import { ApiError } from '@/lib/api/errors';
import type { SetupProgress } from '@/hooks/useSetupProgress';
import type { Ticket } from '@/types';

const mocks = vi.hoisted(() => ({
  useMe: vi.fn(),
  useSetupProgress: vi.fn(),
  useCurrentTicket: vi.fn(),
  useAssignTicket: vi.fn(),
  useSubscription: vi.fn(),
  useExperienceProfile: vi.fn(),
  assignTicket: vi.fn(),
}));

vi.mock('@/hooks/auth/useMe', () => ({ useMe: mocks.useMe }));
vi.mock('@/hooks/useSetupProgress', () => ({ useSetupProgress: mocks.useSetupProgress }));
vi.mock('@/hooks/tickets/useCurrentTicket', () => ({ useCurrentTicket: mocks.useCurrentTicket }));
vi.mock('@/hooks/tickets/useAssignTicket', () => ({ useAssignTicket: mocks.useAssignTicket }));
vi.mock('@/hooks/billing/useSubscription', () => ({ useSubscription: mocks.useSubscription }));
vi.mock('@/hooks/profile/useExperienceProfile', () => ({
  useExperienceProfile: mocks.useExperienceProfile,
}));
vi.mock('@/components/dashboard/ScoreTrendChart', () => ({
  ScoreTrendChart: () => <div data-testid="score-trend-chart" />,
}));

const ticket: Ticket = {
  id: 'ticket-123',
  status: 'assigned',
  templateKey: 'react',
  title: 'Add settings validation',
  scenario: 'A profile page needs validation.',
  category: 'Frontend',
  difficulty: 'Intermediate',
  touchedFiles: [],
  acceptanceCriteria: [],
  testChecklist: [],
  branchName: 'feat/settings-validation',
  repo: { fullName: 'student/worksim', defaultBranch: 'main' },
  createdAt: '2026-09-01T00:00:00.000Z',
  completedAt: null,
  abandonedAt: null,
};

const incompleteProgress: SetupProgress = {
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

const readyProgress: SetupProgress = {
  steps: incompleteProgress.steps.map((step) => ({ ...step, status: 'done' })),
  nextStep: null,
  setupComplete: true,
  canGetTicket: true,
};

function renderDashboard(queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tickets/:ticketId" element={<div>Ticket workspace</div>} />
          <Route path="/billing" element={<div>Billing page</div>} />
          <Route path="/github" element={<div>GitHub page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardPage (FE-082)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMe.mockReturnValue({ data: { id: 'user-1', name: 'Alex Student' } });
    mocks.useSetupProgress.mockReturnValue({
      ...incompleteProgress,
      retry: vi.fn(),
    });
    mocks.useCurrentTicket.mockReturnValue({
      status: 'success',
      data: null,
      error: null,
      refetch: vi.fn(),
      isLoading: false,
      isError: false,
    });
    mocks.useAssignTicket.mockReturnValue({
      mutateAsync: mocks.assignTicket,
      isPending: false,
    });
    mocks.useSubscription.mockReturnValue({ data: undefined, isError: true });
    mocks.useExperienceProfile.mockReturnValue({ data: undefined, isError: true });
  });

  it('shows the setup block reason and keeps the only get-ticket action in CurrentTicketCard', () => {
    renderDashboard();

    expect(screen.getByText('Finish setup to get a ticket.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get.*ticket/i })).not.toBeInTheDocument();
  });

  it('assigns a ticket and navigates to its workspace', async () => {
    mocks.useSetupProgress.mockReturnValue({ ...readyProgress, retry: vi.fn() });
    mocks.assignTicket.mockResolvedValue(ticket);
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: /get your next ticket/i }));

    await waitFor(() => {
      expect(mocks.assignTicket).toHaveBeenCalledOnce();
      expect(screen.getByText('Ticket workspace')).toBeInTheDocument();
    });
  });

  it('keeps a 402 assignment error inline with a billing link', async () => {
    mocks.useSetupProgress.mockReturnValue({ ...readyProgress, retry: vi.fn() });
    mocks.assignTicket.mockRejectedValue(new ApiError(402, 'Subscription required.', 'api'));
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: /get your next ticket/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Subscription required.');
    expect(screen.getByRole('link', { name: 'Go to billing' })).toHaveAttribute('href', '/billing');
  });

  it('resolves a 409 race by navigating to the ticket already assigned', async () => {
    mocks.useSetupProgress.mockReturnValue({ ...readyProgress, retry: vi.fn() });
    mocks.assignTicket.mockRejectedValue(new ApiError(409, 'Do not show this conflict text.', 'api'));
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.currentTicket, ticket);
    expect(queryClient.getQueryData(queryKeys.currentTicket)).toEqual(ticket);
    const refetchQueries = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue(undefined);
    renderDashboard(queryClient);

    fireEvent.click(screen.getByRole('button', { name: /get your next ticket/i }));
    await waitFor(() => expect(mocks.assignTicket).toHaveBeenCalledOnce());

    await waitFor(() => {
      expect(screen.getByText('Ticket workspace')).toBeInTheDocument();
    });
    expect(refetchQueries).toHaveBeenCalledTimes(2);
    expect(refetchQueries).toHaveBeenCalledWith({ queryKey: queryKeys.currentTicket });
    expect(refetchQueries).toHaveBeenCalledWith({ queryKey: queryKeys.githubConnection });
    expect(screen.queryByText('Do not show this conflict text.')).not.toBeInTheDocument();
  });
});