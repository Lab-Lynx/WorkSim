import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export default function ErrorState({
  message,
  onRetry,
  retryLabel = 'Try again',
  className,
}: ErrorStateProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive',
        className
      )}
    >
      <div className="flex items-center gap-3 text-sm">
        <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="font-medium text-foreground">{message}</span>
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/20 hover:text-destructive focus-visible:ring-ring"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
