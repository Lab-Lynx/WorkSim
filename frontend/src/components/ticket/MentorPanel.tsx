import { useEffect, useState } from 'react';
import { MENTOR_MESSAGE_MAX_CHARS } from '@/config/app.config';
import { useMentorMessages } from '@/hooks/mentor/useMentorMessages';
import { useSendMentorMessage } from '@/hooks/mentor/useSendMentorMessage';
import { mapApiError, type UiError } from '@/lib/api/errors';
import type { MentorAvailability } from '@/lib/ticket-phase';
import ErrorState from '@/components/common/ErrorState';
import MentorComposer from '@/components/ticket/MentorComposer';
import MentorMessageList, { type PendingMentorMessage } from '@/components/ticket/MentorMessageList';

export interface MentorPanelProps {
	ticketId: string;
	mentor: MentorAvailability;
	hasAccess: boolean;
}

export default function MentorPanel({ ticketId, mentor, hasAccess }: MentorPanelProps): React.JSX.Element {
	const messagesQuery = useMentorMessages(ticketId);
	const sendMutation = useSendMentorMessage(ticketId);
	const messages = messagesQuery.data ?? [];
	const [pending, setPending] = useState<PendingMentorMessage | null>(null);
	const [limitReached, setLimitReached] = useState<string | null>(null);

	useEffect(() => {
		if (pending?.status !== 'failed' || !pending.error?.isTimeout) return;

		let cancelled = false;
		void messagesQuery.refetch().then((result) => {
			const refreshedMessages = result.data ?? messagesQuery.data ?? [];
			if (!cancelled && refreshedMessages.length >= pending.baseCount + 2) {
				setPending(null);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [messagesQuery, pending]);

	const handleSend = async (content: string) => {
		if (pending?.status === 'sending') return;

		const baseCount = messages.length;
		setLimitReached(null);
		setPending({ content, status: 'sending', baseCount, error: null });

		try {
			await sendMutation.mutateAsync({ content });
			setPending(null);
		} catch (error: unknown) {
			const mappedError: UiError = mapApiError(error);
			if (mappedError.status === 429) {
				setPending(null);
				setLimitReached(mappedError.message);
				return;
			}
			setPending({ content, status: 'failed', baseCount, error: mappedError });
		}
	};

	let disabledReason: string | null = null;
	if (mentor !== 'read_only') {
		if (!hasAccess) {
			disabledReason = 'An active subscription is required.';
		} else if (mentor === 'not_started') {
			disabledReason = 'Start the ticket to use the mentor.';
		} else if (mentor === 'unavailable_after_submit') {
			disabledReason = 'The mentor is only available while the ticket is in progress or revision (D-04).';
		} else if (limitReached) {
			disabledReason = limitReached;
		}
	}

	return (
		<section aria-label="Mentor conversation" className="space-y-4">
			<h3 className="text-base font-semibold text-foreground">Mentor</h3>
			{messagesQuery.isLoading ? (
				<div role="status" aria-label="Loading mentor messages" className="space-y-3">
					<div className="h-4 w-2/3 animate-pulse bg-muted" />
					<div className="h-4 w-1/2 animate-pulse bg-muted" />
				</div>
			) : messagesQuery.isError ? (
				<ErrorState message="Could not load mentor messages." onRetry={() => void messagesQuery.refetch()} />
			) : messages.length === 0 ? (
				<p className="text-sm text-muted-foreground">Ask your mentor for a progressive hint when you need guidance.</p>
			) : null}

			{!messagesQuery.isLoading && !messagesQuery.isError && (
				<MentorMessageList
					messages={messages}
					pending={pending}
					canRetry={mentor === 'enabled'}
					onRetry={() => {
						if (pending?.status === 'failed' && mentor === 'enabled') {
							void handleSend(pending.content);
						}
					}}
				/>
			)}

			{mentor !== 'read_only' && (
				<MentorComposer
					disabledReason={disabledReason}
					isSending={sendMutation.isPending || pending?.status === 'sending'}
					maxChars={MENTOR_MESSAGE_MAX_CHARS}
					onSend={(content) => void handleSend(content)}
				/>
			)}

			<p className="text-xs text-muted-foreground">
				Your mentor conversation is included in your final review.
			</p>
		</section>
	);
}
