import { Check, FileCode } from 'lucide-react';
import type { Ticket } from '@/types';

export interface TicketDetailsProps {
  ticket: Ticket;
}

export default function TicketDetails({ ticket }: TicketDetailsProps): React.JSX.Element {
  return (
    <section aria-label="Ticket details" className="space-y-6">
      <section aria-labelledby="ticket-scenario-heading" className="space-y-2">
        <h2 id="ticket-scenario-heading" className="text-base font-semibold">Scenario</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground text-pretty">
          {ticket.scenario}
        </p>
      </section>

      {ticket.touchedFiles.length > 0 && (
        <section aria-labelledby="ticket-files-heading" className="space-y-2">
          <h2 id="ticket-files-heading" className="text-base font-semibold">Touched files</h2>
          <ul className="flex flex-col gap-2">
            {ticket.touchedFiles.map((file) => (
              <li key={file} className="flex items-center gap-2.5 text-sm">
                <FileCode className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-mono text-xs">{file}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ticket.acceptanceCriteria.length > 0 && (
        <section aria-labelledby="ticket-criteria-heading" className="space-y-2">
          <h2 id="ticket-criteria-heading" className="text-base font-semibold">Acceptance criteria</h2>
          <ul className="flex flex-col gap-3">
            {ticket.acceptanceCriteria.map((criterion, index) => (
              <li key={`${index}-${criterion}`} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="leading-relaxed text-pretty">{criterion}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ticket.testChecklist.length > 0 && (
        <section aria-labelledby="ticket-checklist-heading" className="space-y-2">
          <h2 id="ticket-checklist-heading" className="text-base font-semibold">Test checklist</h2>
          <ul className="flex flex-col gap-2">
            {ticket.testChecklist.map((item, index) => (
              <li
                key={`${index}-${item}`}
                className="rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
