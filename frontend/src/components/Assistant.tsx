/* eslint-disable react-refresh/only-export-components */
'use client';

import { VoxideClient, VoxideWidget } from '@voxide/react';
import { apiRequest } from '@/lib/api/client';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
import router from '@/routes';
import { ROUTES } from '@/constants';
import type {
  Ticket,
  Submission,
  AbandonResult,
  MentorMessage,
  GitHubConnectionSummary,
  ProfileItem,
  SubscriptionStatusResponse,
} from '@/types';
import type { SendMentorMessageResult } from '@/hooks/mentor/useSendMentorMessage';

// Publishable key — safe to ship in the browser
export const ai = new VoxideClient({
  publicKey: 'vox_pub_fb95760987d4a4566570993f7d6ee30502cc6b30062b0300',
});

// Auto-register navigation for app routes
ai.enableNavigation(
  {
    push: (route: string) => {
      void router.navigate(route);
    },
  },
  [
    { path: ROUTES.HOME, description: 'Home simulation overview' },
    {
      path: ROUTES.DASHBOARD,
      description: 'Work simulation dashboard with active ticket, progress, and assignments',
    },
    { path: ROUTES.LOGIN, description: 'Sign in to an existing account' },
    { path: ROUTES.REGISTER, description: 'Create a new account' },
    { path: ROUTES.FORGOT_PASSWORD, description: 'Request password reset' },
    { path: ROUTES.RESET_PASSWORD, description: 'Set new password with reset token' },
    { path: ROUTES.VERIFY_EMAIL, description: 'Verify email address' },
  ]
);

function getActiveTicketId(): string | null {
  const cached = queryClient.getQueryData<Ticket | null>(queryKeys.currentTicket);
  if (cached?.id) return cached.id;
  const path =
    router.state?.location?.pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '');
  const match = path.match(/^\/tickets\/([^/]+)/);
  if (match?.[1]) return match[1];
  return null;
}

async function resolveActiveTicketId(ticketId?: string): Promise<string | null> {
  if (ticketId) return ticketId;
  const current = getActiveTicketId();
  if (current) return current;
  try {
    const response = await apiRequest<{ ticket: Ticket | null }>('GET', '/tickets/current');
    if (response.data.ticket) {
      queryClient.setQueryData(queryKeys.currentTicket, response.data.ticket);
      return response.data.ticket.id;
    }
  } catch {
    // Ignore fetch error and handle null target below
  }
  return null;
}

// Register real capabilities for WorkSim
ai.register({
  getCurrentTicket: {
    description:
      "Get details about the user's currently assigned engineering simulation ticket, including title, scenario, difficulty, acceptance criteria, test checklist, status, and branch.",
    params: {},
    handler: async () => {
      try {
        const cached = queryClient.getQueryData<Ticket | null>(queryKeys.currentTicket);
        if (cached) {
          return {
            status: 'ok',
            ticket: {
              id: cached.id,
              title: cached.title,
              status: cached.status,
              difficulty: cached.difficulty,
              category: cached.category,
              scenario: cached.scenario,
              branchName: cached.branchName,
              acceptanceCriteria: cached.acceptanceCriteria,
              testChecklist: cached.testChecklist,
            },
          };
        }

        const response = await apiRequest<{ ticket: Ticket | null }>('GET', '/tickets/current');
        const ticket = response.data.ticket;

        if (!ticket) {
          return {
            status: 'no_ticket',
            message: 'No ticket is currently assigned. Ask to assign a ticket to get started.',
          };
        }

        queryClient.setQueryData(queryKeys.currentTicket, ticket);
        return {
          status: 'ok',
          ticket: {
            id: ticket.id,
            title: ticket.title,
            status: ticket.status,
            difficulty: ticket.difficulty,
            category: ticket.category,
            scenario: ticket.scenario,
            branchName: ticket.branchName,
            acceptanceCriteria: ticket.acceptanceCriteria,
            testChecklist: ticket.testChecklist,
          },
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch current ticket';
        return { status: 'error', message };
      }
    },
  },

  assignTicket: {
    description:
      'Assign a new engineering simulation ticket to the user to begin working on.',
    params: {},
    handler: async () => {
      try {
        const response = await apiRequest<{ ticket: Ticket }>('POST', '/tickets');
        const ticket = response.data.ticket;

        queryClient.setQueryData(queryKeys.ticket(ticket.id), {
          ticket,
          submissions: [],
        });
        queryClient.setQueryData(queryKeys.currentTicket, ticket);

        return {
          status: 'assigned',
          ticket: {
            id: ticket.id,
            title: ticket.title,
            category: ticket.category,
            difficulty: ticket.difficulty,
            scenario: ticket.scenario,
            branchName: ticket.branchName,
          },
          message: `Assigned new ticket: ${ticket.title}`,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to assign ticket';
        return { status: 'error', message };
      }
    },
  },

  startTicket: {
    description:
      'Start working on an assigned engineering ticket, moving its status to in_progress.',
    params: {
      ticketId: {
        type: 'string',
        required: false,
        description: 'Optional ticket ID. If omitted, uses the current active ticket.',
      },
    },
    handler: async (args: Record<string, unknown> = {}) => {
      try {
        const ticketId = typeof args.ticketId === 'string' ? args.ticketId : undefined;
        const targetId = await resolveActiveTicketId(ticketId);
        if (!targetId) {
          return {
            status: 'error',
            message: 'No active ticket found to start. Please assign a ticket first.',
          };
        }

        const response = await apiRequest<{ ticket: Ticket }>(
          'POST',
          `/tickets/${targetId}/start`
        );
        const ticket = response.data.ticket;

        queryClient.setQueryData(queryKeys.ticket(targetId), (old: unknown) => {
          const prev = old as { submissions?: Submission[] } | undefined;
          return {
            ticket,
            submissions: prev?.submissions ?? [],
          };
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.currentTicket });

        return {
          status: 'started',
          ticket: { id: ticket.id, title: ticket.title, status: ticket.status },
          message: `Started work on ticket: ${ticket.title}`,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to start ticket';
        return { status: 'error', message };
      }
    },
  },

  submitWork: {
    description:
      "Submit the user's completed work on the active engineering ticket for automated CI testing and mentor evaluation.",
    params: {
      ticketId: {
        type: 'string',
        required: false,
        description: 'Optional ticket ID. If omitted, uses the current active ticket.',
      },
    },
    handler: async (args: Record<string, unknown> = {}) => {
      try {
        const ticketId = typeof args.ticketId === 'string' ? args.ticketId : undefined;
        const targetId = await resolveActiveTicketId(ticketId);
        if (!targetId) {
          return { status: 'error', message: 'No active ticket found to submit.' };
        }

        const response = await apiRequest<{ submission: Submission }>(
          'POST',
          `/tickets/${targetId}/submissions`
        );
        const submission = response.data.submission;

        queryClient.setQueryData(
          queryKeys.submission(targetId, submission.attempt, false),
          submission
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(targetId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.currentTicket });

        return {
          status: 'submitted',
          attempt: submission.attempt,
          submissionStatus: submission.status,
          prUrl: submission.prUrl,
          message: `Work submitted for attempt ${submission.attempt}. PR is created at ${submission.prUrl}.`,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to submit work';
        return { status: 'error', message };
      }
    },
  },

  askMentor: {
    description:
      'Ask the AI engineering mentor a technical question or for guidance on the current ticket.',
    params: {
      content: {
        type: 'string',
        required: true,
        description: 'The question or guidance needed from the mentor.',
      },
      ticketId: {
        type: 'string',
        required: false,
        description: 'Optional ticket ID. Defaults to current active ticket.',
      },
    },
    handler: async (args: Record<string, unknown> = {}) => {
      try {
        const content = typeof args.content === 'string' ? args.content : '';
        const ticketId = typeof args.ticketId === 'string' ? args.ticketId : undefined;
        const targetId = await resolveActiveTicketId(ticketId);
        if (!targetId) {
          return {
            status: 'error',
            message: 'No active ticket found to ask the mentor about.',
          };
        }
        if (!content.trim()) {
          return {
            status: 'error',
            message: 'Please provide a question or topic to ask the mentor.',
          };
        }

        const response = await apiRequest<SendMentorMessageResult>(
          'POST',
          `/tickets/${targetId}/mentor/messages`,
          { body: { content } }
        );
        const { userMessage, mentorMessage } = response.data;

        const existing = queryClient.getQueryData<MentorMessage[]>(queryKeys.mentor(targetId));
        if (existing) {
          queryClient.setQueryData(queryKeys.mentor(targetId), [
            ...existing,
            userMessage,
            mentorMessage,
          ]);
        } else {
          queryClient.invalidateQueries({ queryKey: queryKeys.mentor(targetId) });
        }

        return {
          status: 'ok',
          reply: mentorMessage.content,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to reach mentor';
        return { status: 'error', message };
      }
    },
  },

  abandonTicket: {
    description:
      'Abandon the currently assigned ticket. This action is irreversible and cancels your work on the ticket.',
    dangerous: true,
    params: {
      ticketId: {
        type: 'string',
        required: false,
        description: 'Optional ticket ID to abandon. Defaults to current active ticket.',
      },
    },
    handler: async (args: Record<string, unknown> = {}) => {
      try {
        const ticketId = typeof args.ticketId === 'string' ? args.ticketId : undefined;
        const targetId = await resolveActiveTicketId(ticketId);
        if (!targetId) {
          return { status: 'error', message: 'No active ticket found to abandon.' };
        }

        const response = await apiRequest<AbandonResult>(
          'POST',
          `/tickets/${targetId}/abandon`
        );

        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(targetId) });
        if (response.data.newTicket) {
          queryClient.setQueryData(queryKeys.ticket(response.data.newTicket.id), {
            ticket: response.data.newTicket,
            submissions: [],
          });
          queryClient.setQueryData(queryKeys.currentTicket, response.data.newTicket);
        } else {
          queryClient.setQueryData(queryKeys.currentTicket, null);
          queryClient.invalidateQueries({ queryKey: queryKeys.currentTicket });
        }

        return {
          status: 'abandoned',
          message: 'Ticket has been abandoned.',
          newTicket: response.data.newTicket
            ? { id: response.data.newTicket.id, title: response.data.newTicket.title }
            : null,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to abandon ticket';
        return { status: 'error', message };
      }
    },
  },

  getGitHubStatus: {
    description:
      'Check GitHub connection status and repository details for the work simulation.',
    params: {},
    handler: async () => {
      try {
        const response = await apiRequest<GitHubConnectionSummary>(
          'GET',
          '/github/connection'
        );
        queryClient.setQueryData(queryKeys.githubConnection, response.data);

        return {
          status: 'ok',
          connected: response.data.connected,
          githubLogin: response.data.githubLogin,
          repo: response.data.repo
            ? {
                fullName: response.data.repo.fullName,
                defaultBranch: response.data.repo.defaultBranch,
              }
            : null,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to get GitHub status';
        return { status: 'error', message };
      }
    },
  },

  getExperienceProfile: {
    description:
      "Get the user's completed simulation tickets, scores, and evaluation feedback.",
    params: {},
    handler: async () => {
      try {
        const response = await apiRequest<{ items: ProfileItem[] }>('GET', '/profile');
        return {
          status: 'ok',
          totalCompleted: response.data.items.length,
          completedCount: response.data.items.length,
          tickets: response.data.items.map((item) => ({
            id: item.ticketId,
            title: item.title,
            difficulty: item.difficulty,
            scores: item.evaluation?.scores ?? null,
          })),
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load experience profile';
        return { status: 'error', message };
      }
    },
  },

  getSubscriptionStatus: {
    description:
      "Check the user's current subscription status and access to the simulation platform.",
    params: {},
    handler: async () => {
      try {
        const response = await apiRequest<SubscriptionStatusResponse>(
          'GET',
          '/subscriptions/me'
        );
        return {
          status: 'ok',
          hasAccess: response.data.hasAccess,
          subscriptionStatus: response.data.subscription?.status ?? 'none',
          currentPeriodEnd: response.data.subscription?.currentPeriodEnd ?? null,
        };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to check subscription status';
        return { status: 'error', message };
      }
    },
  },
});

// Bind live UI and session state to the agent every turn
ai.bindState(() => {
  const user = useAuthStore.getState().user;
  const currentTicket = queryClient.getQueryData<Ticket | null>(queryKeys.currentTicket) ?? null;
  const currentPath =
    router.state?.location?.pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '/');

  return {
    currentPage: currentPath,
    isAuthenticated: Boolean(user),
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      : null,
    currentTicket: currentTicket
      ? {
          id: currentTicket.id,
          title: currentTicket.title,
          status: currentTicket.status,
          difficulty: currentTicket.difficulty,
          category: currentTicket.category,
          branchName: currentTicket.branchName,
        }
      : null,
  };
});

// Synchronize authenticated user identity with Voxide
function syncUser() {
  const user = useAuthStore.getState().user;
  if (user) {
    ai.setUser({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
  } else {
    ai.setUser(null);
  }
}

syncUser();
useAuthStore.subscribe(() => {
  syncUser();
});

// Synchronize active route with Voxide
if (router.state?.location?.pathname) {
  ai.setActiveRoute(router.state.location.pathname);
}
router.subscribe((state) => {
  if (state.location?.pathname) {
    ai.setActiveRoute(state.location.pathname);
  }
});

export function Assistant() {
  return <VoxideWidget client={ai} accentColor="#EBEBEB" />;
}

export default Assistant;
