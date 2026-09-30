import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { type ApiError, shouldRetryQuery } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { MentorMessage } from '@/types';

export type { MentorMessage };

export type UseMentorMessagesOptions = Omit<
  UseQueryOptions<MentorMessage[], ApiError, MentorMessage[]>,
  'queryKey' | 'queryFn'
>;

export function useMentorMessages(
  ticketId: string | undefined,
  options?: UseMentorMessagesOptions
): UseQueryResult<MentorMessage[], ApiError> {
  return useQuery({
    queryKey: queryKeys.mentor(ticketId ?? ''),
    queryFn: async (): Promise<MentorMessage[]> => {
      // EP-29 GET /tickets/:ticketId/mentor/messages
      const response = await apiRequest<{ messages: MentorMessage[] }>(
        'GET',
        `/tickets/${ticketId}/mentor/messages`
      );
      return response.data.messages;
    },
    enabled: Boolean(ticketId) && (options?.enabled ?? true),
    retry: shouldRetryQuery,
    ...options,
  });
}
