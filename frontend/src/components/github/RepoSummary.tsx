import { forwardRef } from 'react';
import { ExternalLink } from '@/components/common/ExternalLink';
import { buildBranchUrl, buildRepoUrl } from '@/lib/github';
import type { Repo } from '@/types';

export interface RepoSummaryProps {
    repo: Repo;
}

export const RepoSummary = forwardRef<HTMLHeadingElement, RepoSummaryProps>(
    function RepoSummary({ repo }, ref) {
        const repoUrl = buildRepoUrl(repo.fullName);
        const branchUrl = buildBranchUrl(repo.fullName, repo.defaultBranch);

        return (
            <section className="border-y border-border py-5">
                <h2 ref={ref} tabIndex={-1} className="text-lg font-semibold text-foreground outline-none">
                    {repoUrl ? (
                        <ExternalLink href={repoUrl}>{repo.fullName}</ExternalLink>
                    ) : (
                        repo.fullName
                    )}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    Created from template: <span className="font-medium text-foreground">{repo.starterTemplate}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Default branch:{' '}
                    {branchUrl ? (
                        <ExternalLink href={branchUrl} className="font-mono text-foreground">
                            {repo.defaultBranch}
                        </ExternalLink>
                    ) : (
                        <span className="font-mono text-foreground">{repo.defaultBranch}</span>
                    )}
                </p>
            </section>
        );
    }
);

RepoSummary.displayName = 'RepoSummary';

export default RepoSummary;