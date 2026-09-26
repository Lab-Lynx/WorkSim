export interface Ticket {
  id: string;
  title: string;
  status: string;
}

export function useCurrentTicket() {
  // Skeleton implementation (can be replaced with your React Query fetch later)
  return {
    data: null as Ticket | null,
    isLoading: false,
    error: null,
  };
}
