import { Check, CircleAlert, ExternalLink, Info, X } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/** Preview submissions for UI design work until a list endpoint exists. */
const PREVIEW_SUBMISSIONS = [
  {
    id: 'sub-1',
    ticketId: 'WS-214',
    ticketTitle: 'Fix race condition in cart quantity updates',
    attempt: 1,
    maxAttempts: 2,
    submittedAt: 'Oct 18, 2025 · 2:14 PM',
    prNumber: 58,
    prBranch: 'fix/cart-race-214',
    baseBranch: 'main',
    commitSha: 'b2f7d10',
    ciChecks: [
      { name: 'Unit tests', status: 'fail' as const },
      { name: 'Lint', status: 'pass' as const },
      { name: 'Build', status: 'pass' as const },
      { name: 'E2E tests', status: 'fail' as const },
    ],
    failureReason:
      'Sequencing guard is not implemented in useCartQuantity. Stale responses can still overwrite newer state.',
    status: 'needs_changes' as const,
    feedback:
      'Good start — the debounce on the stepper click is solid. Focus next on discarding stale responses.',
    score: null,
  },
  {
    id: 'sub-2',
    ticketId: 'WS-198',
    ticketTitle: 'Add pagination to admin order list endpoint',
    attempt: 2,
    maxAttempts: 2,
    submittedAt: 'Sep 24, 2025 · 6:47 PM',
    prNumber: 44,
    prBranch: 'feat/orders-pagination',
    baseBranch: 'main',
    commitSha: '91c4e8a',
    ciChecks: [
      { name: 'Unit tests', status: 'pass' as const },
      { name: 'Lint', status: 'pass' as const },
      { name: 'Build', status: 'pass' as const },
    ],
    failureReason: null,
    status: 'passed' as const,
    feedback: 'Solid cursor implementation with correct edge-case handling on the final page.',
    score: 91,
  },
];

const statusLabel: Record<string, string> = {
  feedback_ready: 'Feedback ready',
  evaluating: 'Evaluating',
  passed: 'Passed',
  needs_changes: 'Feedback ready',
};

export default function SubmissionsPage() {
  useDocumentTitle('Submissions');

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium tracking-tight">Submissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every pull request you have submitted for evaluation, with CI results and evaluator
          feedback.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {PREVIEW_SUBMISSIONS.map((sub) => {
          const isFirstAttemptPending =
            sub.attempt < sub.maxAttempts && sub.status === 'needs_changes';
          return (
            <Card key={sub.id}>
              <CardHeader className="flex-row items-start justify-between gap-4 border-b pb-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {sub.ticketId}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Attempt {sub.attempt} · Maximum {sub.maxAttempts} attempts
                    </span>
                  </div>
                  <p className="text-sm font-medium text-pretty">{sub.ticketTitle}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge variant="outline" className="capitalize">
                    {statusLabel[sub.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{sub.submittedAt}</span>
                </div>
              </CardHeader>
              <CardContent className="grid gap-6 pt-2 sm:grid-cols-[1.1fr_1fr]">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Pull request</span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                      #{sub.prNumber} — {sub.prBranch} → {sub.baseBranch}
                      <ExternalLink className="size-3.5" />
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Commit</span>
                    <span className="w-fit rounded-md bg-muted px-2 py-1 font-mono text-xs">
                      {sub.commitSha}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-muted-foreground">CI status</span>
                    <ul className="flex flex-col gap-1.5">
                      {sub.ciChecks.map((check) => (
                        <li key={check.name} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            {check.status === 'pass' ? (
                              <Check className="size-3.5 text-primary" />
                            ) : (
                              <X className="size-3.5 text-destructive" />
                            )}
                            {check.name}
                          </span>
                          <span
                            className={
                              check.status === 'pass'
                                ? 'font-mono text-xs text-primary'
                                : 'font-mono text-xs text-destructive'
                            }
                          >
                            {check.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {sub.failureReason && (
                    <div
                      role="alert"
                      className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                    >
                      <div className="mb-1 flex items-center gap-2 font-medium">
                        <CircleAlert className="size-4" />
                        Failure reason
                      </div>
                      {sub.failureReason}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  {isFirstAttemptPending ? (
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                      <div className="mb-1 flex items-center gap-2 font-medium">
                        <Info className="size-4" />
                        Scores hidden
                      </div>
                      Scores are not shown for attempt {sub.attempt}. Address the feedback and
                      resubmit for a full evaluation.
                    </div>
                  ) : sub.score != null ? (
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                      <span className="font-heading text-3xl font-medium tabular-nums text-primary">
                        {sub.score}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">out of 100</span>
                        <span className="text-xs text-muted-foreground">Final evaluation score</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">Evaluator feedback</span>
                    <p className="text-sm leading-relaxed text-pretty">{sub.feedback}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
