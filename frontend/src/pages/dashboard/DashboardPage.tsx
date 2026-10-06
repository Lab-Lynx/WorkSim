import { useState, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Flame,
  MessageSquare,
  Target,
  Trophy,
} from 'lucide-react';
import { useMe } from '@/hooks/auth/useMe';
import { useSetupProgress } from '@/hooks/useSetupProgress';
import { useCurrentTicket } from '@/hooks/tickets/useCurrentTicket';
import { useAssignTicket } from '@/hooks/tickets/useAssignTicket';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { useExperienceProfile } from '@/hooks/profile/useExperienceProfile';
import SetupChecklist from '@/components/dashboard/SetupChecklist';
import CurrentTicketCard from '@/components/dashboard/CurrentTicketCard';
import { ScoreTrendChart } from '@/components/dashboard/ScoreTrendChart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { mapApiError, type UiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { ROUTES } from '@/constants';
import type { GitHubConnectionSummary, Ticket } from '@/types';

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="font-heading text-2xl font-medium tracking-tight">{value}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  const progress = useSetupProgress();
  const currentTicket = useCurrentTicket();
  const assignTicket = useAssignTicket();
  const subscriptionQuery = useSubscription({ retry: false });
  const profileQuery = useExperienceProfile({ retry: false });
  const [getError, setGetError] = useState<UiError | null>(null);
  const [getErrorLink, setGetErrorLink] = useState<{ to: string; label: string } | null>(null);

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const profileItems = profileQuery.data ?? [];
  const recentFromProfile = profileItems.slice(0, 3).map((item) => {
    const score = item.evaluation.scores?.total ?? null;
    return {
      id: item.ticketId,
      title: item.title,
      completedAt: item.completedAt
        ? new Date(item.completedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '—',
      score,
    };
  });

  const recent = recentFromProfile;
  const scoreHistory = [...recentFromProfile].reverse().map((item) => ({
    ticket: item.id.slice(0, 8),
    score: item.score ?? 0,
  }));

  const scoredItems = profileItems.filter((item) => item.evaluation.scores?.total != null);
  const averageScore =
    scoredItems.length > 0
      ? Math.round(
          scoredItems.reduce((sum, item) => sum + (item.evaluation.scores?.total ?? 0), 0) /
            scoredItems.length,
        )
      : null;

  const subscriptionData = subscriptionQuery.data;
  const sub = subscriptionData?.subscription;
  const freeTickets = subscriptionData?.freeTickets;
  const hasPaidPlan = Boolean(sub) && subscriptionData?.hasAccess === true;
  const subscription = sub
    ? {
        status: sub.status,
        plan: 'Practitioner',
        priceLabel: '450 ETB / month',
        nextBillingDate: sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          : '—',
      }
    : {
        status: freeTickets && freeTickets.remaining === 0 ? 'free tickets used' : 'free trial',
        plan: 'Free',
        priceLabel: freeTickets
          ? `${freeTickets.remaining} of ${freeTickets.limit} free tickets left`
          : '—',
        nextBillingDate: '—',
      };

  const handleGetTicket = async () => {
    setGetError(null);
    setGetErrorLink(null);

    try {
      const ticket = await assignTicket.mutateAsync();
      navigate(`/tickets/${ticket.id}`);
    } catch (error: unknown) {
      const uiError = mapApiError(error);

      if (uiError.status === 402) {
        setGetErrorLink({ to: '/billing', label: 'Go to billing' });
      } else if (uiError.status === 403) {
        setGetErrorLink({ to: '/github', label: 'Reconnect GitHub' });
      } else if (uiError.status === 409) {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: queryKeys.currentTicket }),
          queryClient.refetchQueries({ queryKey: queryKeys.githubConnection }),
        ]);

        const assignedTicket = queryClient.getQueryData<Ticket | null>(queryKeys.currentTicket);
        if (assignedTicket) {
          navigate(`/tickets/${assignedTicket.id}`);
          return;
        }

        const connection = queryClient.getQueryData<GitHubConnectionSummary>(
          queryKeys.githubConnection,
        );
        if (connection?.repo === null) {
          setGetErrorLink({ to: '/github', label: 'Create your starter repository' });
        }
      }

      setGetError(uiError);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-heading text-3xl font-medium tracking-tight text-balance md:text-4xl">
          {firstName}, your bench is warm.
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
          One active ticket, a live mentor thread, and a growing work-sample record — this is where
          the practice compounds.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Trophy}
          label="Tickets completed"
          value={String(profileItems.length)}
          hint="Completed work samples"
        />
        <StatCard
          icon={Target}
          label="Average score"
          value={averageScore != null ? `${averageScore} / 100` : '—'}
          hint="Across completed tickets"
        />
        <StatCard
          icon={Flame}
          label="Tickets started"
          value={freeTickets ? String(freeTickets.used) : '—'}
          hint={hasPaidPlan ? 'Unlimited on your plan' : 'Counts toward your free tickets'}
        />
        <StatCard
          icon={MessageSquare}
          label="Free tickets left"
          value={
            hasPaidPlan ? 'Unlimited' : freeTickets ? `${freeTickets.remaining} / ${freeTickets.limit}` : '—'
          }
          hint={hasPaidPlan ? 'Subscription active' : 'Subscribe to keep practicing'}
        />
      </div>

      {!progress.setupComplete && (
        <Card>
          <CardHeader>
            <CardDescription>Getting started</CardDescription>
            <CardTitle className="font-heading text-xl font-medium">Setup progress</CardTitle>
          </CardHeader>
          <CardContent>
            <SetupChecklist progress={progress} onRetry={progress.retry} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardDescription>Active ticket</CardDescription>
            <CardTitle className="font-heading text-xl font-medium">Current work</CardTitle>
          </CardHeader>
          <CardContent>
            <CurrentTicketCard
              query={{
                status: currentTicket.status,
                ticket: currentTicket.data,
                error: currentTicket.error ? mapApiError(currentTicket.error) : null,
                refetch: () => void currentTicket.refetch(),
              }}
              canGetTicket={
                progress.canGetTicket ||
                (progress.steps.find((s) => s.key === 'connect_github')?.status === 'done' &&
                  progress.steps.find((s) => s.key === 'create_repo')?.status === 'done' &&
                  currentTicket.data === null)
              }
              getBlockedReason={
                currentTicket.data
                  ? 'Complete or abandon your active ticket before requesting a new one.'
                  : !progress.setupComplete &&
                    progress.steps.find((s) => s.key === 'connect_github')?.status === 'done' &&
                    progress.steps.find((s) => s.key === 'create_repo')?.status === 'done'
                    ? null
                    : progress.setupComplete
                      ? null
                      : 'Finish setup to get a ticket.'
              }
              isGetting={assignTicket.isPending}
              getError={getError}
              getErrorLink={getErrorLink}
              onGetTicket={() => void handleGetTicket()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Subscription</CardDescription>
            <CardTitle className="font-heading text-xl font-medium capitalize">
              {subscription.status}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{subscription.plan}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Price</span>
              <span className="font-medium">{subscription.priceLabel}</span>
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Next billing date</span>
              <span className="font-medium">{subscription.nextBillingDate}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link to={ROUTES.BILLING}>Manage billing</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardDescription>Rubric performance</CardDescription>
            <CardTitle className="font-heading text-xl font-medium">
              Score trend across submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scoreHistory.length > 0 ? (
              <ScoreTrendChart data={scoreHistory} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Complete your first ticket to see your score trend.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Recently completed</CardDescription>
            <CardTitle className="font-heading text-xl font-medium">Latest work samples</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {recent.length === 0 && (
              <p className="text-sm text-muted-foreground">No completed tickets yet.</p>
            )}
            {recent.map((ticket) => (
              <div key={ticket.id} className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium leading-tight">{ticket.title}</span>
                  <span className="text-xs text-muted-foreground">{ticket.completedAt}</span>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {ticket.score != null ? `${ticket.score}/100` : '—'}
                </Badge>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="ghost" className="w-full" asChild>
              <Link to={ROUTES.PROFILE}>
                View full profile
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
