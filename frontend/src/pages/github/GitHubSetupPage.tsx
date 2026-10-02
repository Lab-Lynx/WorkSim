import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGitHubConnection } from '@/hooks/github/useGitHubConnection';
import { useGitHubConnect } from '@/hooks/github/useGitHubConnect';
import { useDisconnectGitHub } from '@/hooks/github/useDisconnectGitHub';
import { useCreateRepo } from '@/hooks/github/useCreateRepo';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { parseGitHubOAuthResult } from '@/lib/github';
import { mapApiError, type UiError } from '@/lib/api/errors';
import GitHubConnectionCard from '@/components/github/GitHubConnectionCard';
import RepoCreateForm from '@/components/github/RepoCreateForm';
import RepoSummary from '@/components/github/RepoSummary';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import type { GitHubConnectionSummary } from '@/types';

export default function GitHubSetupPage(): React.JSX.Element {
    useDocumentTitle('GitHub and repository');

    const [searchParams, setSearchParams] = useSearchParams();
    const [oauthResult, setOAuthResult] = useState(() => parseGitHubOAuthResult(searchParams));
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectError, setConnectError] = useState<UiError | null>(null);
    const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
    const [disconnectError, setDisconnectError] = useState<string | null>(null);
    const [repoError, setRepoError] = useState<UiError | null>(null);
    const repoHeadingRef = useRef<HTMLHeadingElement>(null);

    const connectionQuery = useGitHubConnection();
    const connection: GitHubConnectionSummary = connectionQuery.data ?? {
        connected: false,
        githubLogin: null,
        repo: null,
    };
    const subscriptionQuery = useSubscription();
    const hasAccess = Boolean(subscriptionQuery.data?.hasAccess);
    const connectMutation = useGitHubConnect();
    const disconnectMutation = useDisconnectGitHub();
    const createRepoMutation = useCreateRepo();

    useEffect(() => {
        const result = parseGitHubOAuthResult(searchParams);
        if (!result) return;

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('github');
        nextParams.delete('reason');
        setSearchParams(nextParams, { replace: true });
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        if (connection.repo) {
            repoHeadingRef.current?.focus();
        }
    }, [connection.repo]);

    const handleConnect = async () => {
        setIsConnecting(true);
        setConnectError(null);
        try {
            const authorizeUrl = await connectMutation.mutateAsync();
            window.location.assign(authorizeUrl);
        } catch (error: unknown) {
            setIsConnecting(false);
            setConnectError(mapApiError(error));
        }
    };

    const handleConfirmDisconnect = async () => {
        setDisconnectError(null);
        try {
            await disconnectMutation.mutateAsync();
            setIsDisconnectDialogOpen(false);
        } catch (error: unknown) {
            const mappedError = mapApiError(error);
            if (mappedError.status === 404) {
                setIsDisconnectDialogOpen(false);
                await connectionQuery.refetch();
                return;
            }
            if (mappedError.status === 403) {
                await connectionQuery.refetch();
            }
            setDisconnectError(mappedError.message);
        }
    };

    const handleCreateRepo = async (values: import('@/schemas/github.schemas').CreateRepoInput) => {
        setRepoError(null);
        try {
            await createRepoMutation.mutateAsync(values);
        } catch (error: unknown) {
            const mappedError = mapApiError(error);
            setRepoError(mappedError);
            if (mappedError.status === 403) {
                await connectionQuery.refetch();
            }
        }
    };

    const blocked = !connection.connected
        ? {
              message: 'Connect GitHub to create your repository.',
              linkTo: '#github-connection',
              linkLabel: 'Connect GitHub',
          }
        : !hasAccess
          ? {
                message: 'An active subscription is required.',
                linkTo: '/billing',
                linkLabel: 'Billing',
            }
          : null;

    return (
        <div className="mx-auto flex max-w-2xl flex-col gap-6 py-6">
            <h1 tabIndex={-1} className="text-xl font-semibold tracking-tight text-foreground outline-none">
                GitHub and repository
            </h1>

            <section id="github-connection" aria-label="GitHub connection">
                <GitHubConnectionCard
                    connection={connection}
                    hasAccess={hasAccess}
                    oauthResult={oauthResult}
                    onDismissResult={() => setOAuthResult(null)}
                    isConnecting={isConnecting || connectMutation.isPending}
                    connectError={connectError}
                    onConnect={() => void handleConnect()}
                    onDisconnectClick={() => {
                        setDisconnectError(null);
                        setIsDisconnectDialogOpen(true);
                    }}
                />
            </section>

            <section aria-label="Starter repository" className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground">Starter repository</h2>
                {connection.repo ? (
                    <RepoSummary ref={repoHeadingRef} repo={connection.repo} />
                ) : (
                    <RepoCreateForm
                        onSubmit={handleCreateRepo}
                        isPending={createRepoMutation.isPending}
                        error={repoError}
                        blocked={blocked}
                    />
                )}
            </section>

            <ConfirmDialog
                open={isDisconnectDialogOpen}
                onOpenChange={(open) => {
                    setIsDisconnectDialogOpen(open);
                    if (!open) setDisconnectError(null);
                }}
                title="Disconnect GitHub account?"
                description="Disconnecting will prevent WorkSim from pushing code updates or grading your active tickets."
                confirmLabel="Disconnect"
                cancelLabel="Cancel"
                destructive
                isPending={disconnectMutation.isPending}
                errorMessage={disconnectError}
                onConfirm={() => void handleConfirmDisconnect()}
            />
        </div>
    );
}