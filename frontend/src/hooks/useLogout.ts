// src/hooks/useLogout.ts

interface UseLogoutOptions {
    onError?: (error: any) => void;
    onSuccess?: () => void;
}

export function useLogout() {
    const mutate = (_variables?: void, _options?: UseLogoutOptions) => {
        // Placeholder logout implementation
    };

    return {
        mutate,
        isPending: false,
    };
}