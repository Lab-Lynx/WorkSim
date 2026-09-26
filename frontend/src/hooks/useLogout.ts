// src/hooks/useLogout.ts

interface UseLogoutOptions {
  onError?: (error: unknown) => void;
  onSuccess?: () => void;
}

export function useLogout() {
  const mutate = (variables?: void, options?: UseLogoutOptions) => {
    void variables;
    void options;
    // Placeholder logout implementation
  };

  return {
    mutate,
    isPending: false,
  };
}
