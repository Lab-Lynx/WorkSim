import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGitHubConnection } from '@/hooks/github/useGitHubConnection';
import { useGitHubConnect } from '@/hooks/github/useGitHubConnect';
import { useDisconnectGitHub } from '@/hooks/github/useDisconnectGitHub';
import SubmitButton from '@/components/common/SubmitButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ExternalLink } from '@/components/common/ExternalLink';
import { ROUTES } from '@/constants';

export const GITHUB_PERMISSIONS_TEXT =
    'WorkSim requires read and write access to your GitHub repositories to create starter templates and evaluate your code.';

interface GitHubConnectionCardProps {
    hasAccess: boolean;
    oauthErrorMessage?: string | null;
}

export default function GitHubConnectionCard({
    hasAccess,
    oauthErrorMessage,
}: GitHubConnectionCardProps): React.JSX.Element {
    const { data: connection, isLoading } = useGitHubConnection();
    const connectMutation = useGitHubConnect();
    const disconnectMutation = useDisconnectGitHub();

    const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

    const handleConnect = async () => {
        try {
            const authUrl = await connectMutation.mutateAsync();
            if (authUrl) {
                window.location.assign(authUrl);
            }
        } catch {
            // Error state handled via connectMutation.isError / oauthErrorMessage
        }
    };

    const handleDisconnect = async () => {
        try {
            await disconnectMutation.mutateAsync();
            setIsDisconnectDialogOpen(false);
        } catch {
            // Error state handled via disconnectMutation.isError
        }
    };

    const isConnected = Boolean(connection?.connected);
    const githubLogin = connection?.githubLogin;
    const isPending = connectMutation.isPending || isLoading;

    const errorMessage =
        oauthErrorMessage ||
        (connectMutation.isError ? 'Failed to connect to GitHub. Please try again.' : null);

    return (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">1. Connect GitHub Account</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{GITHUB_PERMISSIONS_TEXT}</p>
                </div>

                {!hasAccess && !isConnected && (
                    <div
                        role="status"
                        className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground"
                    >
                        An active subscription is required.{' '}
                        <Link
                            to={ROUTES.BILLING}
                            className="text-primary underline underline-offset-4 hover:text-primary/90 font-medium"
                        >
                            Billing
                        </Link>
                    </div>
                )}

                {errorMessage && (
                    <div
                        role="alert"
                        className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive font-medium"
                    >
                        {errorMessage}
                    </div>
                )}

                {isConnected ? (
                    <div className="flex flex-col gap-3">
                        <div
                            role="status"
                            className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary font-medium flex items-center justify-between"
                        >
                            <span>
                                Connected as{' '}
                                {githubLogin ? (
                                    <ExternalLink
                                        href={`https://github.com/${githubLogin}`}
                                        className="font-bold underline underline-offset-2"
                                    >
                                        @{githubLogin}
                                    </ExternalLink>
                                ) : (
                                    'GitHub User'
                                )}
                            </span>
                        </div>

                        <div>
                            <button
                                type="button"
                                onClick={() => setIsDisconnectDialogOpen(true)}
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                            >
                                Disconnect GitHub
                            </button>

                            <ConfirmDialog
                                open={isDisconnectDialogOpen}
                                onOpenChange={setIsDisconnectDialogOpen}
                                title="Disconnect GitHub account?"
                                description="Disconnecting will prevent WorkSim from pushing code updates or grading your active tickets."
                                confirmLabel="Disconnect"
                                cancelLabel="Cancel"
                                destructive
                                isPending={disconnectMutation.isPending}
                                errorMessage={
                                    disconnectMutation.isError
                                        ? 'Failed to disconnect. Please try again.'
                                        : null
                                }
                                onConfirm={handleDisconnect}
                            />
                        </div>
                    </div>
                ) : (
                    <div>
                        <SubmitButton
                            type="button"
                            onClick={handleConnect}
                            disabled={!hasAccess || isPending}
                            isPending={connectMutation.isPending}
                            pendingLabel="Redirecting to GitHub…"
                        >
                            Connect GitHub
                        </SubmitButton>
                    </div>
                )}
            </div>
        </div>
    );
}