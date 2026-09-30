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
		<div className="space-y-2">
			<label htmlFor="mentor-message" className="text-sm font-medium text-foreground">
				Message to the mentor
			</label>
			<textarea
				id="mentor-message"
				value={value}
				onChange={(event) => setValue(event.target.value)}
				disabled={Boolean(disabledReason) || isSending}
				aria-describedby={disabledReason ? 'mentor-composer-reason' : undefined}
				rows={3}
				className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
			/>
			{disabledReason && (
				<p id="mentor-composer-reason" className="text-sm text-muted-foreground">
					{disabledReason}
				</p>
			)}
			{maxChars !== null && (
				<p className="text-right text-xs text-muted-foreground" aria-live="polite">
					{value.length} / {maxChars}
				</p>
			)}
			<div className="flex justify-end">
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
