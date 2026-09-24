import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  title,
  description,
  children,
  className,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-6 sm:p-8 rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground',
        className
      )}
    >
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>}
      {children && <div className={cn(description ? 'mt-0' : 'mt-3')}>{children}</div>}
    </div>
  );
}
