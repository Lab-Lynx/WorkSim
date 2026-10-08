import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Plus,
} from 'lucide-react';
import { useSubmissions } from '@/hooks/submissions/useSubmissions';
import { friendlyMessage } from '@/lib/api/friendly-error';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import { useGitHubConnection } from '@/hooks/github/useGitHubConnection';
import { useGitHubConnect } from '@/hooks/github/useGitHubConnect';
import { useDisconnectGitHub } from '@/hooks/github/useDisconnectGitHub';
import { useCreateRepo } from '@/hooks/github/useCreateRepo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { parseGitHubOAuthResult } from '@/lib/github';
import { mapApiError, type UiError } from '@/lib/api/errors';
import GitHubConnectionCard from '@/components/github/GitHubConnectionCard';
import RepoCreateForm from '@/components/github/RepoCreateForm';
import RepoSummary from '@/components/github/RepoSummary';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { GitHubConnectionSummary } from '@/types';

const RECENT_PR_LIMIT = 5;

function formatActivityDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function GitHubSetupPage(): React.JSX.Element {
  useDocumentTitle('GitHub and repository');

  const [searchParams, setSearchParams] = useSearchParams();
  const [oauthResult, setOAuthResult] = useState(() => parseGitHubOAuthResult(searchParams));
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<UiError | null>(null);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [repoError, setRepoError] = useState<UiError | null>(null);
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const repoHeadingRef = useRef<HTMLHeadingElement>(null);

  const connectionQuery = useGitHubConnection();
  const connection: GitHubConnectionSummary = connectionQuery.data ?? {
    connected: false,
    githubLogin: null,
    repo: null,
  };
  const submissionsQuery = useSubmissions({ enabled: connection.connected });
  const recentSubmissions = (submissionsQuery.data ?? []).slice(0, RECENT_PR_LIMIT);
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
      setIsCreatingRepo(false);
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
    : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1
          tabIndex={-1}
          className="font-heading text-2xl font-medium tracking-tight text-foreground outline-none"
        >
          GitHub and repository
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your repositories are provisioned automatically for each ticket and kept in sync with your
          submissions.
        </p>
      </div>

      <Card id="github-connection">
        <CardContent className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
              <GitBranch className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">GitHub</span>
                {connection.connected ? (
                  <Badge variant="secondary" className="gap-1 text-primary">
                    <CheckCircle2 className="size-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {connection.githubLogin ? `@${connection.githubLogin}` : 'Connect to continue setup'}
              </p>
            </div>
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <GitHubConnectionCard
            connection={connection}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="font-heading text-base font-medium">
              Current task repository
            </CardTitle>
            <CardDescription>
              {connection.repo
                ? `Provisioned as ${connection.repo.fullName}`
                : 'Create your starter repository to begin tickets'}
            </CardDescription>
          </div>
          {connection.repo && (
            <Button variant="ghost" size="sm" type="button" asChild>
              <a
                href={`https://github.com/${connection.repo.fullName}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink data-icon="inline-start" />
                Open
              </a>
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-5" aria-label="Starter repository">
          <h2 className="sr-only">Starter repository</h2>
          {connection.repo && !isCreatingRepo ? (
            <div className="flex flex-col gap-5">
              <RepoSummary ref={repoHeadingRef} repo={connection.repo} />
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild className="gap-2">
                  <Link to="/tickets">
                    Continue working
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  className="gap-2"
                  onClick={() => {
                    setRepoError(null);
                    setIsCreatingRepo(true);
                  }}
                >
                  <Plus className="size-4" />
                  Create repo
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {connection.repo && isCreatingRepo && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Current repository: </span>
                    <span className="font-mono font-medium text-foreground">{connection.repo.fullName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="default" className="gap-1.5">
                      <Link to="/tickets">
                        Continue working
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setRepoError(null);
                        setIsCreatingRepo(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              <RepoCreateForm
                onSubmit={handleCreateRepo}
                isPending={createRepoMutation.isPending}
                error={repoError}
                blocked={blocked}
              />
              {!connection.repo && (
                <div className="flex items-center gap-3">
                  <Button asChild variant="outline" size="sm" className="gap-2 text-muted-foreground">
                    <Link to="/tickets">
                      Continue working
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base font-medium">Recent pull requests</CardTitle>
        </CardHeader>
        <CardContent>
          {!connection.connected ? (
            <EmptyState
              title="Nothing to show yet"
              description="Connect GitHub to see the pull requests you submit."
            />
          ) : submissionsQuery.isLoading ? (
            <div role="status" aria-label="Loading pull requests" className="h-16 animate-pulse rounded-md bg-muted" />
          ) : submissionsQuery.isError ? (
            <ErrorState
              message={friendlyMessage(submissionsQuery.error, 'We could not load your pull requests.')}
              onRetry={() => void submissionsQuery.refetch()}
            />
          ) : recentSubmissions.length === 0 ? (
            <EmptyState
              title="No pull requests yet"
              description="Pull requests you submit for evaluation will appear here."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {recentSubmissions.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <GitPullRequest className="size-3.5" aria-hidden="true" />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <a
                      href={item.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm leading-relaxed text-pretty hover:underline"
                    >
                      PR #{item.prNumber} · {item.ticket.title}
                    </a>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{item.headSha.slice(0, 7)}</span>
                      <span>·</span>
                      <span>{formatActivityDate(item.submittedAt)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
