import { Link } from 'react-router-dom';
import { CircleAlert, ExternalLink, Info, Loader2 } from 'lucide-react';
import { useSubmissions } from '@/hooks/submissions/useSubmissions';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { friendlyMessage } from '@/lib/api/friendly-error';
import { MAX_SUBMISSION_ATTEMPTS, ROUTES } from '@/constants';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { SubmissionListItem, SubmissionStatus } from '@/types';

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  awaiting_ci: 'Waiting for CI',
  evaluating: 'Evaluating',
  completed: 'Evaluated',
  failed: 'Failed',
};

function formatSubmittedAt(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ciLabel(ciPassed: boolean | null): { text: string; className: string } {
  if (ciPassed === true) return { text: 'Passed', className: 'text-primary' };
  if (ciPassed === false) return { text: 'Failed', className: 'text-destructive' };
  return { text: 'Pending', className: 'text-muted-foreground' };
}

function SubmissionCard({ sub }: { sub: SubmissionListItem }) {
  const ci = ciLabel(sub.ciPassed);
  const score = sub.evaluation?.scores?.total ?? null;
  const scoresHidden = sub.evaluation !== null && sub.evaluation.scores === null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 border-b pb-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{sub.ticket.category}</Badge>
            <span className="text-xs text-muted-foreground">
              Attempt {sub.attempt} of {MAX_SUBMISSION_ATTEMPTS}
            </span>
          </div>
          <Link
            to={`/tickets/${sub.ticket.id}`}
            className="text-sm font-medium text-pretty hover:underline"
          >
            {sub.ticket.title}
          </Link>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant="outline">{STATUS_LABEL[sub.status] ?? sub.status}</Badge>
          <span className="text-xs text-muted-foreground">{formatSubmittedAt(sub.submittedAt)}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-2">
        <div className="grid gap-6 sm:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Pull request</span>
              <a
                href={sub.prUrl}
                target="_blank"
                rel="noreferrer"
                className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                #{sub.prNumber}
                {sub.ticket.branchName && ` · ${sub.ticket.branchName}`}
                {sub.baseBranch && ` → ${sub.baseBranch}`}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Commit</span>
              <span className="w-fit rounded-md bg-muted px-2 py-1 font-mono text-xs">
                {sub.headSha.slice(0, 7)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">CI</span>
              <span className={`text-sm font-medium ${ci.className}`}>
                {ci.text}
                {sub.ciRunUrl && (
                  <a
                    href={sub.ciRunUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs font-normal text-muted-foreground hover:underline"
                  >
                    View run
                  </a>
                )}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {score !== null && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                <span className="font-heading text-3xl font-medium tabular-nums text-primary">
                  {score}
                </span>
                <span className="text-sm font-medium">out of 100</span>
              </div>
            )}

            {scoresHidden && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div className="mb-1 flex items-center gap-2 font-medium">
                  <Info className="size-4" aria-hidden="true" />
                  Scores hidden
                </div>
                Scores are not shown for attempt {sub.attempt}. Address the feedback and resubmit for
                a full evaluation.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t pt-4">
          {sub.failureReason && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <div className="mb-1 flex items-center gap-2 font-medium">
                <CircleAlert className="size-4" aria-hidden="true" />
                Failure reason
              </div>
              {sub.failureReason}
            </div>
          )}

          {sub.evaluation ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Evaluator feedback</span>
              <p className="text-sm leading-relaxed text-pretty whitespace-pre-wrap">{sub.evaluation.feedback}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Feedback will appear once evaluation finishes.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SubmissionsPage() {
  useDocumentTitle('Submissions');
  const submissions = useSubmissions();
  const items = submissions.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <h1 tabIndex={-1} className="font-heading text-2xl font-medium tracking-tight outline-none">
        Submissions
      </h1>

      {submissions.isLoading ? (
        <div
          role="status"
          aria-label="Loading submissions"
          className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading submissions…
        </div>
      ) : submissions.isError ? (
        <ErrorState
          message={friendlyMessage(submissions.error, 'We could not load your submissions.')}
          onRetry={() => void submissions.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No submissions yet"
          description="Submit a pull request on your active ticket and it will show up here."
        >
          <Button asChild>
            <Link to={ROUTES.DASHBOARD}>Go to dashboard</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {items.map((sub) => (
            <SubmissionCard key={sub.id} sub={sub} />
          ))}
        </div>
      )}
    </div>
  );
}
