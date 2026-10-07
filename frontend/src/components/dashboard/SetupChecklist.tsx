import { AlertCircle, CheckCircle2, Circle, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import ErrorState from '@/components/common/ErrorState';
import type { SetupProgress, SetupStep } from '@/hooks/useSetupProgress';

export interface SetupChecklistProps {
  progress: SetupProgress;
  onRetry: () => void;
}

const stepActions: Partial<Record<SetupStep['key'], { to: string; label: string }>> = {
  subscribe: { to: '/billing', label: 'Subscribe' },
  connect_github: { to: '/github', label: 'Connect GitHub' },
  create_repo: { to: '/github', label: 'Create repository' },
};

function getStatusLabel(status: SetupStep['status']): string {
  switch (status) {
    case 'done':
      return 'Complete';
    case 'todo':
      return 'Not started';
    case 'loading':
      return 'Loading';
    case 'error':
      return 'Unavailable';
  }
}

export default function SetupChecklist({
  progress,
  onRetry,
}: SetupChecklistProps): React.JSX.Element {
  if (progress.setupComplete) {
    return (
      <p className="border-y border-border py-4 text-sm font-medium text-foreground">
        Setup complete: GitHub connected, repository ready, subscribed.
      </p>
    );
  }

  return (
    <section aria-label="Setup checklist">
      <ol className="divide-y divide-border border-y border-border">
        {progress.steps.map((step) => {
          const action = progress.nextStep === step.key ? stepActions[step.key] : undefined;
          const StatusIcon =
            step.status === 'done'
              ? CheckCircle2
              : step.status === 'loading'
                ? LoaderCircle
                : step.status === 'error'
                  ? AlertCircle
                  : Circle;

          return (
            <li key={step.key} className="flex min-h-16 items-center gap-3 py-3">
              <StatusIcon
                className={`size-4 shrink-0 ${step.status === 'loading' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{step.label}</p>
                {step.detail && <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>}
                <p className="sr-only">{getStatusLabel(step.status)}</p>
                {step.status === 'loading' && (
                  <div role="status" aria-label={`Loading ${step.label}`} className="mt-2 h-3 w-24 animate-pulse bg-muted" />
                )}
                {step.status === 'error' && (
                  <ErrorState
                    className="mt-2"
                    message={`Couldn't load ${step.label.toLowerCase()}.`}
                    onRetry={onRetry}
                  />
                )}
              </div>
              {action && step.status === 'todo' && (
                <Link to={action.to} className="shrink-0 text-sm font-medium text-primary underline">
                  {action.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
