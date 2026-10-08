import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest, resetSessionExpiredGuard } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';

/** Whether the server has a demo account configured. The credentials are never sent to the browser. */
export function useGuestLoginAvailable(): UseQueryResult<boolean, ApiError> {
  return useQuery({
    queryKey: queryKeys.guestLogin,
    queryFn: async (): Promise<boolean> => {
      const response = await apiRequest<{ enabled: boolean }>('GET', '/auth/guest', {
        skipAuthRefresh: true,
      });
      return response.data.enabled === true;
    },
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useGuestLogin(): UseMutationResult<User, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<User> => {
      const response = await apiRequest<{ user: User }>('POST', '/auth/guest', {
        skipAuthRefresh: true,
      });
      return response.data.user;
    },
    retry: false,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.me, user);
      useAuthStore.getState().setUser(user);
      resetSessionExpiredGuard();
    },
  });
}
