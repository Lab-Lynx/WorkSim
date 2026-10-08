import { useEffect } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { useToastStore, type ToastItem } from '@/store/toast.store';
import { cn } from '@/lib/utils';

const SUCCESS_DURATION_MS = 5_000;
const ERROR_DURATION_MS = 8_000;

function ToastCard({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const isError = toast.variant === 'error';

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), isError ? ERROR_DURATION_MS : SUCCESS_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.id, isError]);

  const Icon = isError ? CircleAlert : CircleCheck;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-lg',
        isError ? 'border-destructive/50' : 'border-border',
      )}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', isError ? 'text-destructive' : 'text-primary')} />
      <p className="flex-1 leading-relaxed text-pretty">{toast.message}</p>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <X aria-hidden="true" className="size-4" />
        <span className="sr-only">Dismiss notification</span>
      </button>
    </div>
  );
}

export default function Toaster() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:left-auto sm:w-96">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
