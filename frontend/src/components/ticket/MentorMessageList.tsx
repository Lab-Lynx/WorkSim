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

interface BubbleProps {
	speaker: 'You' | 'Mentor';
	content: string;
	ariaLabel?: string;
	children?: React.ReactNode;
}

function Bubble({ speaker, content, ariaLabel, children }: BubbleProps): React.JSX.Element {
	const isUser = speaker === 'You';
	return (
		<article
			aria-label={ariaLabel}
			className={`flex max-w-[85%] flex-col gap-1 ${isUser ? 'items-end self-end' : 'items-start self-start'}`}
		>
			<p className="px-1 text-xs font-medium text-muted-foreground">{speaker}</p>
			<p
				className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
					isUser
						? 'rounded-br-md bg-primary text-primary-foreground'
						: 'rounded-bl-md bg-secondary text-secondary-foreground'
				}`}
			>
				{content}
			</p>
			{children}
		</article>
	);
}

export default function MentorMessageList({
	messages,
	pending,
	canRetry,
	onRetry,
}: MentorMessageListProps): React.JSX.Element {
	const endRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const end = endRef.current;
		if (!end || typeof end.scrollIntoView !== 'function') return;

		const prefersReducedMotion =
			typeof window.matchMedia === 'function' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		end.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' });
	}, [messages.length, pending]);

	return (
		<div role="log" aria-live="polite" className="scrollbar-thin flex min-h-48 flex-1 flex-col gap-4 overflow-y-auto pr-1">
			{messages.map((message) => (
				<Bubble
					key={message.id}
					speaker={message.role === 'user' ? 'You' : 'Mentor'}
					content={message.content}
				/>
			))}

			{pending && (
				<Bubble speaker="You" content={pending.content} ariaLabel="Pending message">
					{pending.status === 'sending' ? (
						<p role="status" className="px-1 text-xs text-muted-foreground">
							Mentor is thinking…
						</p>
					) : (
						<div className="flex flex-wrap items-center justify-end gap-2 px-1 text-xs text-destructive">
							<span>Not sent</span>
							{pending.error && <span>{pending.error.message}</span>}
							{canRetry && (
								<button type="button" onClick={onRetry} className="font-medium text-primary underline">
									Retry
								</button>
							)}
						</div>
					)}
				</Bubble>
			)}
			<div ref={endRef} aria-hidden="true" />
		</div>
	);
}
