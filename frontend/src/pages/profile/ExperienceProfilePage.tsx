import { Link } from 'react-router-dom';
import {
  Award,
  Flame,
  MessageCircle,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useExperienceProfile } from '@/hooks/profile/useExperienceProfile';
import { useAuthStore } from '@/store/auth.store';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import PracticeRecordNotice from '@/components/profile/PracticeRecordNotice';
import ExperienceItem from '@/components/profile/ExperienceItem';
import { CategoryChart } from '@/components/profile/CategoryChart';
import { ScoreTrendChart } from '@/components/dashboard/ScoreTrendChart';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PREVIEW_STATS = {
  ticketsCompleted: 4,
  averageScore: 91,
  currentStreak: 4,
  totalMentorMessages: 62,
};

const PREVIEW_SCORE_HISTORY = [
  { ticket: 'WS-160', score: 98 },
  { ticket: 'WS-171', score: 85 },
  { ticket: 'WS-183', score: 97 },
  { ticket: 'WS-198', score: 91 },
];

const PREVIEW_CATEGORIES = [
  { category: 'Feature', count: 2 },
  { category: 'Bug Fix', count: 1 },
  { category: 'Performance', count: 1 },
  { category: 'Security', count: 1 },
];

function initials(name?: string) {
  if (!name) return 'WS';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ExperienceProfilePage(): React.JSX.Element {
  useDocumentTitle('Experience profile');
  const profile = useExperienceProfile();
  const user = useAuthStore((s) => s.user);
  const items = profile.data ?? [];
  const name = user?.name ?? 'Practitioner';

  const scored = items.filter((item) => item.evaluation.scores?.total != null);
  const stats =
    scored.length > 0
      ? {
          ticketsCompleted: items.length,
          averageScore: Math.round(
            scored.reduce((sum, item) => sum + (item.evaluation.scores?.total ?? 0), 0) /
              scored.length,
          ),
          currentStreak: PREVIEW_STATS.currentStreak,
          totalMentorMessages: PREVIEW_STATS.totalMentorMessages,
        }
      : PREVIEW_STATS;

  const scoreHistory =
    scored.length > 0
      ? [...scored]
          .reverse()
          .map((item) => ({
            ticket: item.ticketId.slice(0, 8),
            score: item.evaluation.scores?.total ?? 0,
          }))
      : PREVIEW_SCORE_HISTORY;

  const categoryBreakdown =
    items.length > 0
      ? Object.entries(
          items.reduce<Record<string, number>>((acc, item) => {
            acc[item.category] = (acc[item.category] ?? 0) + 1;
            return acc;
          }, {}),
        ).map(([category, count]) => ({ category, count }))
      : PREVIEW_CATEGORIES;

  const statCards = [
    { label: 'Tickets completed', value: stats.ticketsCompleted, icon: Target },
    { label: 'Average score', value: `${stats.averageScore}/100`, icon: TrendingUp },
    { label: 'Current streak', value: `${stats.currentStreak} weeks`, icon: Flame },
    { label: 'Mentor messages', value: stats.totalMentorMessages, icon: MessageCircle },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar fallback={initials(name)} size="lg" />
          <div className="flex flex-col gap-1">
            <h1
              tabIndex={-1}
              className="font-heading text-2xl font-medium tracking-tight outline-none"
            >
              Your experience profile
            </h1>
            <p className="text-sm text-muted-foreground">{name}</p>
          </div>
        </div>
        <Badge variant="secondary" className="w-fit gap-1.5 self-start sm:self-auto">
          <Award className="size-3.5" />
          Practitioner tier
        </Badge>
      </div>

      <PracticeRecordNotice />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col gap-2 p-5">
              <stat.icon className="size-4 text-primary" />
              <span className="font-heading text-2xl font-medium tracking-tight">{stat.value}</span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base font-medium">Score trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart data={scoreHistory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base font-medium">Tickets by category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryChart data={categoryBreakdown} />
          </CardContent>
        </Card>
      </div>

      {profile.isLoading ? (
        <div role="status" aria-label="Loading experience profile" className="space-y-4">
          <div className="h-5 w-48 animate-pulse bg-muted" />
          <div className="h-24 animate-pulse bg-muted" />
        </div>
      ) : profile.isError ? (
        <ErrorState
          message={profile.error?.message || 'Could not load your experience profile.'}
          onRetry={() => void profile.refetch()}
        />
      ) : !items.length ? (
        <EmptyState
          title="No completed tickets yet."
          description="Finish your first ticket and it will appear here."
        >
          <Button asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </EmptyState>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base font-medium">Work history</CardTitle>
            <p className="text-sm text-muted-foreground">
              {items.length} completed {items.length === 1 ? 'ticket' : 'tickets'}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col" aria-label="Completed tickets">
            {items.map((item) => (
              <ExperienceItem key={item.ticketId} item={item} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
