import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProfileItem } from '@/types';
import { formatDate } from '@/lib/format';
import ScoreBreakdown from '@/components/ticket/ScoreBreakdown';

export interface ExperienceItemProps {
  item: ProfileItem;
}

export default function ExperienceItem({ item }: ExperienceItemProps): React.JSX.Element {
  const [showFullFeedback, setShowFullFeedback] = useState(false);
  const hasLongFeedback = item.evaluation.feedback.length > 160;

  return (
    <article className="space-y-4 border-b border-border py-5 last:border-b-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-medium text-foreground">{item.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Completed {formatDate(item.completedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{item.category}</span>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{item.difficulty}</span>
        </div>
      </header>

      {item.evaluation.scores ? (
        <ScoreBreakdown scores={item.evaluation.scores} />
      ) : (
        <p className="text-sm text-muted-foreground">Score unavailable</p>
      )}

      <section aria-label="Final feedback" className="space-y-2">
        <h3 className="text-sm font-semibold">Final feedback</h3>
        <p className={`whitespace-pre-line text-sm leading-6 text-foreground ${hasLongFeedback && !showFullFeedback ? 'line-clamp-3' : ''}`}>
          {item.evaluation.feedback}
        </p>
        {hasLongFeedback && (
          <button
            type="button"
            aria-expanded={showFullFeedback}
            onClick={() => setShowFullFeedback((expanded) => !expanded)}
            className="text-sm font-medium text-primary underline"
          >
            {showFullFeedback ? 'Show less feedback' : 'Show full feedback'}
          </button>
        )}
      </section>

      <Link
        to={`/tickets/${item.ticketId}?tab=submissions`}
        className="inline-flex text-sm font-medium text-primary underline"
      >
        See feedback history and diff
      </Link>
    </article>
  );
}
