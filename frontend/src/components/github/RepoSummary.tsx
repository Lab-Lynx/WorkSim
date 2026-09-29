import { ExternalLink } from '@/components/common/ExternalLink';
import { CopyButton } from '@/components/common/CopyButton';
import { buildRepoUrl, buildBranchUrl } from '@/lib/github';
import { formatDate } from '@/lib/format';

export interface RepoSummaryProps {
    repositoryName: string;
    templateName?: string | null;
    defaultBranch?: string;
    createdAt?: string | null;
    updatedAt?: string | null;
    className?: string;
}

export function RepoSummary({
    repositoryName,
    templateName,
    defaultBranch = 'main',
    createdAt,
    updatedAt,
    className = '',
}: RepoSummaryProps) {
    const repoUrl = buildRepoUrl(repositoryName);
    const branchUrl = buildBranchUrl(repositoryName, defaultBranch);

    return (
        <div className={`rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm ${className}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg leading-none tracking-tight">
                            {repoUrl ? (
                                <ExternalLink href={repoUrl} className="hover:underline">
                                    {repositoryName}
                                </ExternalLink>
                            ) : (
                                <span>{repositoryName}</span>
                            )}
                        </h3>
                    </div>

                    {templateName && (
                        <p className="text-xs text-text-muted">
                            Created from template: <span className="font-medium text-foreground">{templateName}</span>
                        </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                        {defaultBranch && (
                            <div className="flex items-center gap-1">
                                <span>Default branch:</span>
                                {branchUrl ? (
                                    <ExternalLink href={branchUrl} className="font-mono text-foreground hover:underline">
                                        {defaultBranch}
                                    </ExternalLink>
                                ) : (
                                    <span className="font-mono text-foreground">{defaultBranch}</span>
                                )}
                            </div>
                        )}

                        {createdAt && (
                            <div>
                                Created: <span className="text-foreground">{formatDate(createdAt)}</span>
                            </div>
                        )}

                        {updatedAt && (
                            <div>
                                Updated: <span className="text-foreground">{formatDate(updatedAt)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {defaultBranch && (
                    <div className="flex items-center pt-2 sm:pt-0">
                        <CopyButton
                            text={`git checkout ${defaultBranch}`}
                            label="Copy branch command"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}