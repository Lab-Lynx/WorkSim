import { Check, FileCode } from 'lucide-react';
import { useState } from 'react';
import type { Ticket } from '@/types';
import { cn } from '@/lib/utils';

const DETAIL_TABS = [
  { id: 'description', label: 'Description' },
  { id: 'criteria', label: 'Acceptance Criteria' },
  { id: 'tests', label: 'Tests' },
  { id: 'files', label: 'Files' },
] as const;

type DetailTab = (typeof DETAIL_TABS)[number]['id'];

export interface TicketDetailsProps {
  ticket: Ticket;
}

export default function TicketDetails({ ticket }: TicketDetailsProps): React.JSX.Element {
  const [tab, setTab] = useState<DetailTab>('description');

  return (
    <section aria-label="Ticket details" className="flex flex-col gap-4">
      <div role="tablist" aria-label="Ticket detail sections" className="flex flex-wrap gap-1">
        {DETAIL_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === item.id
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'description' && (
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty whitespace-pre-wrap">
          {ticket.scenario}
        </p>
      )}

      {tab === 'criteria' && (
        <ul className="flex flex-col gap-3">
          {ticket.acceptanceCriteria.length === 0 ? (
            <li className="text-sm text-muted-foreground">No acceptance criteria listed.</li>
          ) : (
            ticket.acceptanceCriteria.map((criterion, index) => (
              <li key={`${index}-${criterion}`} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="leading-relaxed text-pretty">{criterion}</span>
              </li>
            ))
          )}
        </ul>
      )}

      {tab === 'tests' && (
        <ul className="flex flex-col gap-2">
          {ticket.testChecklist.length === 0 ? (
            <li className="text-sm text-muted-foreground">No test checklist listed.</li>
          ) : (
            ticket.testChecklist.map((item, index) => (
              <li
                key={`${index}-${item}`}
                className="rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed"
              >
                {item}
              </li>
            ))
          )}
        </ul>
      )}

      {tab === 'files' && (
        <ul className="flex flex-col gap-2">
          {ticket.touchedFiles.length === 0 ? (
            <li className="text-sm text-muted-foreground">No touched files listed.</li>
          ) : (
            ticket.touchedFiles.map((file) => (
              <li key={file} className="flex items-center gap-2.5 text-sm">
                <FileCode className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-mono text-xs">{file}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
