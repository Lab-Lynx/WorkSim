import type { Ticket } from '@/types';
import type { TicketPhaseInfo } from '@/lib/ticket-phase';
import StatusBadge from '@/components/common/StatusBadge';

export interface TicketHeaderProps {
	ticket: Ticket;
	phase: TicketPhaseInfo;
}

export default function TicketHeader({ ticket, phase }: TicketHeaderProps): React.JSX.Element {
	return (
		<header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
			<h1 tabIndex={-1} className="text-2xl font-semibold leading-tight text-foreground outline-none">
				{ticket.title}
			</h1>
			<div className="flex flex-wrap items-center gap-2">
				<StatusBadge domain="ticket_phase" phase={phase.key} />
				<span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
					{ticket.category}
				</span>
				<span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
					{ticket.difficulty}
				</span>
			</div>
		</header>
	);
}
