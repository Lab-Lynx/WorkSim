/* eslint-disable react-refresh/only-export-components */
import { CopyButton } from '@/components/common/CopyButton';
import { ExternalLink } from '@/components/common/ExternalLink';
import { buildBranchUrl, buildRepoUrl, shellQuote } from '@/lib/github';

export interface BranchInstructionsProps {
	repoFullName: string;
	branchName: string;
}

export { shellQuote };

export default function BranchInstructions({
	repoFullName,
	branchName,
}: BranchInstructionsProps): React.JSX.Element {
	const repoUrl = buildRepoUrl(repoFullName);
	const branchUrl = buildBranchUrl(repoFullName, branchName);
	const commands = [
		{ label: 'Copy git fetch command', text: 'git fetch origin' },
		{ label: 'Copy git checkout command', text: `git checkout ${shellQuote(branchName)}` },
	];

	return (
		<section aria-label="Branch instructions" className="space-y-4 border-y border-border py-5">
			<h3 className="font-semibold text-foreground">Branch instructions</h3>
			<div className="space-y-2 text-sm">
				<p>
					Repository: {repoUrl ? <ExternalLink href={repoUrl}>{repoFullName}</ExternalLink> : <span>{repoFullName}</span>}
				</p>
				<p>
					Branch: {branchUrl ? <ExternalLink href={branchUrl}>{branchName}</ExternalLink> : <span>{branchName}</span>}
				</p>
			</div>
			<ul className="space-y-2">
				{commands.map((command) => (
					<li key={command.label} className="flex flex-wrap items-center justify-between gap-3">
						<code className="min-w-0 break-all rounded bg-muted px-2 py-1 text-xs">{command.text}</code>
						<CopyButton text={command.text} label={command.label} />
					</li>
				))}
			</ul>
		</section>
	);
}
