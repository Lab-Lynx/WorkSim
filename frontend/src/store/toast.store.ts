import { create } from 'zustand';

export type ToastVariant = 'success' | 'error';

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (variant: ToastVariant, message: string) => number;
  dismiss: (id: number) => void;
}

const MAX_VISIBLE = 3;
let nextId = 1;

/** Not persisted: toasts are transient UI feedback only. */
export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (variant, message) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, variant, message }].slice(-MAX_VISIBLE) }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
