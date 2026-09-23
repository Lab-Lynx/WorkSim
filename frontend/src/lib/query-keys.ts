import type { SubmissionAttempt } from '@/types';

export const queryKeys = {
  me: ['me'] as const,
  subscription: ['subscription'] as const,
  payments: ['payments'] as const,
  githubConnection: ['github-connection'] as const,
  currentTicket: ['ticket', 'current'] as const,
  profile: ['profile'] as const,
  ticket: (id: string) => ['ticket', id] as const,
  mentor: (id: string) => ['mentor', id] as const,
  submission: (id: string, attempt: SubmissionAttempt, includeDiff: boolean) =>
    ['submission', id, attempt, includeDiff] as const,
};
