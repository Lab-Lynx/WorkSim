import { useEffect, useRef } from 'react';
import type { MentorMessage } from '@/types';
import type { UiError } from '@/lib/api/errors';

export interface PendingMentorMessage {
	content: string;
	status: 'sending' | 'failed';
	baseCount: number;
	error: UiError | null;
}

export interface MentorMessageListProps {
	messages: MentorMessage[];
	pending: PendingMentorMessage | null;
	canRetry: boolean;
	onRetry: () => void;
}

export default function MentorMessageList({
	messages,
	pending,
	canRetry,
	onRetry,
}: MentorMessageListProps): React.JSX.Element {
	const logRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const log = logRef.current;
		if (!log || typeof log.scrollIntoView !== 'function') return;

		const prefersReducedMotion =
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		log.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'end' });
	}, [messages.length, pending]);

	return (
		<div
			ref={logRef}
			role="log"
			aria-live="polite"
			className="max-h-96 space-y-4 overflow-y-auto"
		>
			{messages.map((message) => (
				<article key={message.id} className="space-y-1">
					<p className="text-xs font-semibold text-muted-foreground">
						{message.role === 'user' ? 'You' : 'Mentor'}
					</p>
					<p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>
				</article>
			))}

			{pending && (
				<article className="space-y-1 border-l-2 border-primary/40 pl-3" aria-label="Pending message">
					<p className="text-xs font-semibold text-muted-foreground">You</p>
					<p className="whitespace-pre-wrap text-sm text-foreground">{pending.content}</p>
					{pending.status === 'sending' ? (
						<p role="status" className="text-xs text-muted-foreground">Mentor is thinking…</p>
					) : (
						<div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
							<span>Not sent</span>
							{pending.error && <span>{pending.error.message}</span>}
							{canRetry && (
								<button type="button" onClick={onRetry} className="font-medium text-primary underline">
									Retry
								</button>
							)}
						</div>
					)}
				</article>
			)}
		</div>
	);
}
