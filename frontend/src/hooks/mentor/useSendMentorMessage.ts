import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { MentorMessage } from '@/types';

export interface SendMentorMessageVariables {
  content: string;
}

export interface SendMentorMessageResult {
  userMessage: MentorMessage;
  mentorMessage: MentorMessage;
}

export type UseSendMentorMessageOptions = Omit<
  UseMutationOptions<SendMentorMessageResult, ApiError, SendMentorMessageVariables>,
  'mutationFn'
>;

export function useSendMentorMessage(
  ticketId: string,
  options?: UseSendMentorMessageOptions
): UseMutationResult<SendMentorMessageResult, ApiError, SendMentorMessageVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      variables: SendMentorMessageVariables
    ): Promise<SendMentorMessageResult> => {
      // EP-28 POST /tickets/:ticketId/mentor/messages with body { content }
      // Long timeout applied inside apiRequest
      // Body is exactly { content } — never a hint level, attempt, or role
      const response = await apiRequest<SendMentorMessageResult>(
        'POST',
        `/tickets/${ticketId}/mentor/messages`,
        {
          body: {
            content: variables.content,
          },
        }
      );
      return response.data;
    },
    retry: false,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      const existing = queryClient.getQueryData<MentorMessage[]>(
        queryKeys.mentor(ticketId)
      );

      if (existing !== undefined) {
        queryClient.setQueryData<MentorMessage[]>(queryKeys.mentor(ticketId), [
          ...existing,
          data.userMessage,
          data.mentorMessage,
        ]);
      } else {
        queryClient.invalidateQueries({
          queryKey: queryKeys.mentor(ticketId),
        });
      }

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      const isTimeout =
        error.kind === 'timeout' ||
        error.status === 408 ||
        error.status === 504 ||
        error.message?.toLowerCase().includes('timeout');

      // Status 409 invalidates queryKeys.ticket(ticketId) (D-04)
      if (error.status === 409) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.ticket(ticketId),
        });
      }

      // Timeout invalidates queryKeys.mentor(ticketId) for reconciliation (A-71)
      if (isTimeout) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.mentor(ticketId),
        });
      }

      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
