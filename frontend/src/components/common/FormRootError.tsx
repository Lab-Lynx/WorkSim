import * as React from 'react';

export interface FormRootErrorProps {
  message?: string | null;
}

export default function FormRootError({ message }: FormRootErrorProps): React.JSX.Element | null {
  if (!message || !message.trim()) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive font-medium dark:border-destructive/30 dark:bg-destructive/15"
    >
      <svg
        className="h-4 w-4 shrink-0 translate-y-0.5"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
      </svg>
      <span className="leading-snug">{message}</span>
    </div>
  );
}
