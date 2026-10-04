import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { Assistant, ai } from '@/components/Assistant';
import * as apiClient from '@/lib/api/client';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
import router from '@/routes';
import type { Ticket, User } from '@/types';

const mockTicket: Ticket = {
  id: 'ticket-uuid-1',
  status: 'assigned',
  templateKey: 'react',
  title: 'Implement Dark Mode',
  scenario: 'Add theme toggle and support dark mode tokens.',
  category: 'Frontend',
  difficulty: 'Medium',
  touchedFiles: ['src/styles/theme.css'],
  acceptanceCriteria: ['Supports dark class on html'],
  testChecklist: ['Theme toggles correctly'],
  branchName: 'feat/dark-mode',
  repo: {
    fullName: 'test-user/worksim-repo',
    defaultBranch: 'main',
  },
  createdAt: '2026-09-01T00:00:00.000Z',
  completedAt: null,
  abandonedAt: null,
};

const mockUser: User = {
  id: 'user-uuid-1',
  name: 'Dev User',
  email: 'dev@example.com',
  role: 'engineer',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('Voxide Assistant integration (Assistant.tsx)', () => {
  let apiRequestSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient.clear();
    useAuthStore.getState().clearAuth();
    apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes VoxideClient with publishable key', () => {
    expect(ai.publicKey).toBe('vox_pub_fb95760987d4a4566570993f7d6ee30502cc6b30062b0300');
  });

  it('renders Assistant widget component', () => {
    const { container } = render(<Assistant />);
    expect(container).toBeDefined();
  });

  it('registers all required WorkSim capabilities', () => {
    expect(ai.actions.has('getCurrentTicket')).toBe(true);
    expect(ai.actions.has('assignTicket')).toBe(true);
    expect(ai.actions.has('startTicket')).toBe(true);
    expect(ai.actions.has('submitWork')).toBe(true);
    expect(ai.actions.has('askMentor')).toBe(true);
    expect(ai.actions.has('abandonTicket')).toBe(true);
    expect(ai.actions.has('getGitHubStatus')).toBe(true);
    expect(ai.actions.has('getExperienceProfile')).toBe(true);
    expect(ai.actions.has('getSubscriptionStatus')).toBe(true);
    expect(ai.actions.has('navigate')).toBe(true);

    for (const capability of [
      'assignTicket',
      'startTicket',
      'submitWork',
      'askMentor',
      'abandonTicket',
    ]) {
      expect(ai.actions.get(capability)?.dangerous).toBe(true);
    }
  });

  it('getCurrentTicket returns cached ticket when present', async () => {
    queryClient.setQueryData(queryKeys.currentTicket, mockTicket);

    const handler = ai.actions.get('getCurrentTicket')?.handler;
    expect(handler).toBeDefined();

    const result = await handler!({});
    expect(result.status).toBe('ok');
    expect(result.ticket.id).toBe(mockTicket.id);
    expect(result.ticket.title).toBe(mockTicket.title);
    expect(apiRequestSpy).not.toHaveBeenCalled();
  });

  it('getCurrentTicket fetches from API when cache is empty', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'OK',
      data: { ticket: mockTicket },
    });

    const handler = ai.actions.get('getCurrentTicket')?.handler;
    const result = await handler!({});

    expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/tickets/current');
    expect(result.status).toBe('ok');
    expect(result.ticket.title).toBe(mockTicket.title);
    expect(queryClient.getQueryData(queryKeys.currentTicket)).toEqual(mockTicket);
  });

  it('getCurrentTicket returns no_ticket when no ticket is assigned', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'OK',
      data: { ticket: null },
    });

    const handler = ai.actions.get('getCurrentTicket')?.handler;
    const result = await handler!({});

    expect(result.status).toBe('no_ticket');
    expect(result.message).toContain('No ticket is currently assigned');
  });

  it('getCurrentTicket handles API failure gracefully', async () => {
    apiRequestSpy.mockRejectedValueOnce(new Error('Network error'));

    const handler = ai.actions.get('getCurrentTicket')?.handler;
    const result = await handler!({});

    expect(result.status).toBe('error');
    expect(result.message).toBe('Network error');
  });

  it('assignTicket calls POST /tickets and updates queryClient cache', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'OK',
      data: { ticket: mockTicket },
    });

    const handler = ai.actions.get('assignTicket')?.handler;
    const result = await handler!({});

    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/tickets');
    expect(result.status).toBe('assigned');
    expect(result.ticket.id).toBe(mockTicket.id);
    expect(queryClient.getQueryData(queryKeys.currentTicket)).toEqual(mockTicket);
  });

  it('startTicket starts work on active ticket', async () => {
    queryClient.setQueryData(queryKeys.currentTicket, mockTicket);
    const startedTicket = { ...mockTicket, status: 'in_progress' as const };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'OK',
      data: { ticket: startedTicket },
    });

    const handler = ai.actions.get('startTicket')?.handler;
    const result = await handler!({});

    expect(apiRequestSpy).toHaveBeenCalledWith(
      'POST',
      `/tickets/${mockTicket.id}/start`
    );
    expect(result.status).toBe('started');
    expect(result.ticket.status).toBe('in_progress');
  });

  it('startTicket returns error if no ticket is available', async () => {
    const handler = ai.actions.get('startTicket')?.handler;
    const result = await handler!({});

    expect(result.status).toBe('error');
    expect(result.message).toContain('No active ticket found');
  });

  it('submitWork submits active ticket for evaluation', async () => {
    queryClient.setQueryData(queryKeys.currentTicket, mockTicket);
    const mockSubmission = {
      id: 'sub-uuid-1',
      attempt: 1 as const,
      status: 'awaiting_ci' as const,
      prNumber: 42,
      prUrl: 'https://github.com/test-user/worksim-repo/pull/42',
      headSha: 'abc1234',
      ciPassed: null,
      ciRunUrl: null,
      failureReason: null,
      submittedAt: '2026-09-01T12:00:00.000Z',
      evaluation: null,
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'OK',
      data: { submission: mockSubmission },
    });

    const handler = ai.actions.get('submitWork')?.handler;
    const result = await handler!({});

    expect(apiRequestSpy).toHaveBeenCalledWith(
      'POST',
      `/tickets/${mockTicket.id}/submissions`
    );
    expect(result.status).toBe('submitted');
    expect(result.attempt).toBe(1);
    expect(result.prUrl).toBe(mockSubmission.prUrl);
  });

  it('askMentor sends message and returns mentor response', async () => {
    queryClient.setQueryData(queryKeys.currentTicket, mockTicket);

    const userMessage = {
      id: 'msg-1',
      role: 'user' as const,
      content: 'How do I test CSS modules?',
      createdAt: '2026-09-01T10:00:00.000Z',
    };
    const mentorMessage = {
      id: 'msg-2',
      role: 'mentor' as const,
      content: 'You can test class presence on DOM nodes with jest-dom.',
      createdAt: '2026-09-01T10:00:05.000Z',
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'OK',
      data: { userMessage, mentorMessage },
    });

    const handler = ai.actions.get('askMentor')?.handler;
    const result = await handler!({ content: 'How do I test CSS modules?' });

    expect(apiRequestSpy).toHaveBeenCalledWith(
      'POST',
      `/tickets/${mockTicket.id}/mentor/messages`,
      { body: { content: 'How do I test CSS modules?' } }
    );
    expect(result.status).toBe('ok');
    expect(result.reply).toBe(mentorMessage.content);
  });

  it('askMentor requires question content', async () => {
    queryClient.setQueryData(queryKeys.currentTicket, mockTicket);

    const handler = ai.actions.get('askMentor')?.handler;
    const result = await handler!({ content: '   ' });

    expect(result.status).toBe('error');
    expect(result.message).toContain('Please provide a question');
  });

  it('abandonTicket abandons current ticket and returns result', async () => {
    queryClient.setQueryData(queryKeys.currentTicket, mockTicket);

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'OK',
      data: { abandonedTicketId: mockTicket.id, newTicket: null },
    });

    const handler = ai.actions.get('abandonTicket')?.handler;
    const result = await handler!({});

    expect(apiRequestSpy).toHaveBeenCalledWith(
      'POST',
      `/tickets/${mockTicket.id}/abandon`
    );
    expect(result.status).toBe('abandoned');
    expect(queryClient.getQueryData(queryKeys.currentTicket)).toBeNull();
  });

  it('getGitHubStatus returns connection and repo info', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'OK',
      data: {
        connected: true,
        githubLogin: 'octocat',
        repo: { fullName: 'octocat/repo', defaultBranch: 'main' },
      },
    });

    const handler = ai.actions.get('getGitHubStatus')?.handler;
    const result = await handler!({});

    expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/github/connection');
    expect(result.status).toBe('ok');
    expect(result.connected).toBe(true);
    expect(result.githubLogin).toBe('octocat');
  });

  it('getExperienceProfile returns completed simulation history', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'OK',
      data: {
        items: [
          {
            ticketId: 't-1',
            title: 'Fix CSRF',
            category: 'Security',
            difficulty: 'Hard',
            completedAt: '2026-09-01T00:00:00.000Z',
            evaluation: {
              feedback: 'Great solution',
              scores: {
                requirementsMet: 100,
                correctnessTests: 100,
                codeQuality: 90,
                problemSolving: 95,
                total: 96,
              },
              createdAt: '2026-09-01T00:00:00.000Z',
            },
          },
        ],
      },
    });

    const handler = ai.actions.get('getExperienceProfile')?.handler;
    const result = await handler!({});

    expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/profile');
    expect(result.status).toBe('ok');
    expect(result.completedCount).toBe(1);
  });

  it('getSubscriptionStatus returns current plan access', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'OK',
      data: {
        hasAccess: true,
        subscription: {
          id: 'sub-1',
          status: 'active',
          currentPeriodEnd: '2026-12-31T00:00:00.000Z',
          canceledAt: null,
        },
      },
    });

    const handler = ai.actions.get('getSubscriptionStatus')?.handler;
    const result = await handler!({});

    expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/subscriptions/me');
    expect(result.status).toBe('ok');
    expect(result.hasAccess).toBe(true);
    expect(result.subscriptionStatus).toBe('active');
  });

  it('navigate handler navigates via router.navigate', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(undefined as never);

    const handler = ai.actions.get('navigate')?.handler;
    expect(handler).toBeDefined();

    const result = await handler!({ route: '/dashboard' });
    expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
    expect(result.status).toBe('navigated');
  });

  it('bindState exposes live session and ticket state', () => {
    useAuthStore.getState().setUser(mockUser);
    queryClient.setQueryData(queryKeys.currentTicket, mockTicket);

    const snapshot = ai._getCurrentStateSnapshot();
    expect(snapshot.isAuthenticated).toBe(true);
    expect(snapshot.user).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      role: mockUser.role,
    });
    expect(snapshot.currentTicket).toEqual({
      id: mockTicket.id,
      title: mockTicket.title,
      status: mockTicket.status,
      difficulty: mockTicket.difficulty,
      category: mockTicket.category,
      branchName: mockTicket.branchName,
    });
  });

  it('syncs authenticated user to ai.setUser', () => {
    useAuthStore.getState().setUser(mockUser);
    expect(ai.user).toEqual({
      userId: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
    });

    useAuthStore.getState().clearAuth();
    expect(ai.user).toBeNull();
  });
});
