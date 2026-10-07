import { useState } from 'react';
import SubmitButton from '@/components/common/SubmitButton';

export interface MentorComposerProps {
	disabledReason: string | null;
	isSending: boolean;
	maxChars: number | null;
	onSend: (content: string) => void;
}

export default function MentorComposer({
	disabledReason,
	isSending,
	maxChars,
	onSend,
}: MentorComposerProps): React.JSX.Element {
	const [value, setValue] = useState('');
	const trimmedValue = value.trim();
	const isOverLimit = maxChars !== null && value.length > maxChars;
	const disabled = Boolean(disabledReason) || !trimmedValue || isOverLimit;

	const handleSend = () => {
		if (disabled || isSending) return;
		onSend(trimmedValue);
		setValue('');
	};

	return (
		<div className="space-y-2 border-t border-border/60 pt-4">
			<label htmlFor="mentor-message" className="sr-only">
				Message to the mentor
			</label>
			<textarea
				id="mentor-message"
				value={value}
				onChange={(event) => setValue(event.target.value)}
				disabled={Boolean(disabledReason) || isSending}
				aria-describedby={disabledReason ? 'mentor-composer-reason' : undefined}
				placeholder="Ask for a hint or describe where you are stuck."
				rows={3}
				className="w-full resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
			/>
			{disabledReason && (
				<p id="mentor-composer-reason" className="text-sm text-muted-foreground">
					{disabledReason}
				</p>
			)}
			<div className="flex items-center justify-between gap-3">
				{maxChars !== null ? (
					<p
						className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}
						aria-live="polite"
					>
						{value.length} / {maxChars}
					</p>
				) : (
					<span />
				)}
				<SubmitButton
					type="button"
					isPending={isSending}
					pendingLabel="Sending…"
					disabled={disabled}
					onClick={handleSend}
				>
					Send
				</SubmitButton>
			</div>
		</div>
	);
}
