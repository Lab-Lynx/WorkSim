import { Code, GitBranch } from 'lucide-react';
import type { Ticket } from '@/types';
import type { TicketPhaseInfo } from '@/lib/ticket-phase';
import StatusBadge from '@/components/common/StatusBadge';

export interface TicketHeaderProps {
  ticket: Ticket;
  phase: TicketPhaseInfo;
}

export default function TicketHeader({ ticket, phase }: TicketHeaderProps): React.JSX.Element {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{ticket.id.slice(0, 8)}</span>
        <span>·</span>
        <span>{ticket.category}</span>
        <span>·</span>
        <span>{ticket.difficulty}</span>
        <StatusBadge domain="ticket_phase" phase={phase.key} />
      </div>
      <h1
        tabIndex={-1}
        className="font-heading text-2xl font-medium tracking-tight text-balance outline-none md:text-3xl"
      >
        {ticket.title}
      </h1>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Code className="size-3.5" />
          <span className="font-mono">{ticket.repo.fullName}</span>
        </span>
        <span className="flex items-center gap-1">
          <GitBranch className="size-3.5" />
          {ticket.branchName}
        </span>
      </div>
    </header>
  );
}
