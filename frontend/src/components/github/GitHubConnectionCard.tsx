import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from '@/components/common/ExternalLink';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants';
import { getGitHubOAuthErrorMessage, type GitHubOAuthResult } from '@/lib/github';
import type { UiError } from '@/lib/api/errors';
import type { GitHubConnectionSummary } from '@/types';

export const GITHUB_PERMISSIONS_TEXT =
    'WorkSim requires read and write access to your GitHub repositories to create starter templates and evaluate your code.';

interface GitHubConnectionCardProps {
    connection: GitHubConnectionSummary;
    hasAccess: boolean;
    oauthResult: GitHubOAuthResult | null;
    onDismissResult: () => void;
    isConnecting: boolean;
    connectError: UiError | null;
    onConnect: () => void;
    onDisconnectClick: () => void;
}

export default function GitHubConnectionCard({
    connection,
    hasAccess,
    oauthResult,
    onDismissResult,
    isConnecting,
    connectError,
    onConnect,
    onDisconnectClick,
}: GitHubConnectionCardProps): React.JSX.Element {
    const isConnected = connection.connected;
    const oauthErrorMessage =
        oauthResult?.status === 'error' ? getGitHubOAuthErrorMessage(oauthResult.reason) : null;

    return (
        <section className="flex flex-col gap-4 border-y border-border py-5">
            <div className="flex flex-col gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">1. Connect GitHub Account</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{GITHUB_PERMISSIONS_TEXT}</p>
                </div>

                {oauthResult?.status === 'connected' && (
                    <div
                        role="status"
                        className="flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary"
                    >
                        <span>GitHub connected.</span>
                        <Button type="button" variant="ghost" size="sm" onClick={onDismissResult}>
                            Dismiss
                        </Button>
                    </div>
                )}

                {oauthErrorMessage && (
                    <div
                        role="alert"
                        className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive font-medium"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span>{oauthErrorMessage}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={onDismissResult}>
                                Dismiss
                            </Button>
                        </div>
                    </div>
                )}

                {connectError && (
                    <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                        {connectError.message}
                    </div>
                )}

                {isConnected ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p role="status" className="text-sm text-foreground">
                            Connected as{' '}
                            {connection.githubLogin ? (
                                <ExternalLink href={`https://github.com/${connection.githubLogin}`}>
                                    @{connection.githubLogin}
                                </ExternalLink>
                            ) : (
                                'GitHub user'
                            )}
                        </p>
                        <Button type="button" variant="outline" onClick={onDisconnectClick}>
                            Disconnect GitHub
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-3">
                        <Button type="button" onClick={onConnect} disabled={!hasAccess || isConnecting}>
                            {isConnecting ? 'Redirecting to GitHub…' : 'Connect GitHub'}
                        </Button>
                        {!hasAccess && (
                            <p className="text-sm text-muted-foreground">
                                An active subscription is required.{' '}
                                <Link to={ROUTES.BILLING} className="font-medium text-primary underline">
                                    Billing
                                </Link>
                            </p>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}