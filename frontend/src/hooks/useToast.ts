import { useToastStore } from '@/store/toast.store';

const toast = {
  error: (message: string) => {
    useToastStore.getState().push('error', message);
  },
  success: (message: string) => {
    useToastStore.getState().push('success', message);
  },
};

export function useToast() {
  return { toast };
}
