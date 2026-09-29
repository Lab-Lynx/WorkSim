/* eslint-disable react-refresh/only-export-components */
import React, { useMemo, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { createRepoSchema, type CreateRepoInput } from '@/schemas/github.schemas';
import { useGitHubConnection } from '@/hooks/github/useGitHubConnection';
import { useGitHubConnect } from '@/hooks/github/useGitHubConnect';
import { useDisconnectGitHub } from '@/hooks/github/useDisconnectGitHub';
import { useCreateRepo } from '@/hooks/github/useCreateRepo';
import { useSubscription } from '@/hooks/billing/useSubscription';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { parseGitHubOAuthResult, getGitHubOAuthErrorMessage, buildRepoUrl } from '@/lib/github';
import { applyServerErrorToForm } from '@/lib/api/errors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import FormRootError from '@/components/common/FormRootError';
import SubmitButton from '@/components/common/SubmitButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export default function GitHubSetupPage(): React.JSX.Element {
    useDocumentTitle('GitHub Setup');

    const [searchParams] = useSearchParams();
    const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
    const [disconnectError, setDisconnectError] = useState<string | null>(null);

    const { data: connection, refetch: refetchConnection, isLoading: isConnLoading } = useGitHubConnection();
    const { data: subscription } = useSubscription();

    const connectMutation = useGitHubConnect();
    const disconnectMutation = useDisconnectGitHub();
    const createRepoMutation = useCreateRepo();

    const oauthResult = useMemo(() => parseGitHubOAuthResult(searchParams), [searchParams]);
    const oauthErrorMessage = oauthResult?.status === 'error' ? getGitHubOAuthErrorMessage(oauthResult.reason) : null;

    const isConnected = Boolean(connection?.connected);
    const hasAccess = Boolean(subscription?.hasAccess);
    const isFormBlocked = !isConnected || !hasAccess;

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(createRepoSchema),
        defaultValues: {
            starterTemplate: 'react',
            repoName: '',
        },
        mode: 'onSubmit',
        reValidateMode: 'onChange',
    });

    const handleConnectGitHub = async () => {
        try {
            const authorizeUrl = await connectMutation.mutateAsync();
            if (authorizeUrl) {
                window.location.assign(authorizeUrl);
            }
        } catch {
            // Handled via UI or mutation state
        }
    };

    const handleConfirmDisconnect = async () => {
        setDisconnectError(null);
        try {
            await disconnectMutation.mutateAsync();
            setIsDisconnectDialogOpen(false);
        } catch (err: any) {
            if (err?.status === 404) {
                setIsDisconnectDialogOpen(false);
                refetchConnection();
            } else if (err?.status === 403) {
                await refetchConnection();
                setDisconnectError(err?.message || 'Action forbidden.');
            } else {
                setDisconnectError(err?.message || 'Failed to disconnect GitHub.');
            }
        }
    };

    const onSubmit: SubmitHandler<CreateRepoInput> = async (values) => {
        try {
            await createRepoMutation.mutateAsync(values);
        } catch (err: unknown) {
            applyServerErrorToForm(err, { setError });
        }
    };

    // Build repository URL safely based on fullName
    const repoUrl = connection?.repo
        ? (buildRepoUrl(connection.repo.fullName) ?? (connection.repo as any).url ?? (connection.repo as any).htmlUrl ?? null)
        : null;

    // Fallback for username property
    const githubUser = (connection as any)?.username ?? (connection as any)?.connectedAs ?? (connection as any)?.githubUsername ?? '';

    return (
        <div className="flex flex-col gap-6 max-w-2xl mx-auto py-6">
            <h1
                tabIndex={-1}
                className="text-xl font-semibold tracking-tight text-foreground outline-none"
            >
                GitHub Setup
            </h1>

            {oauthErrorMessage && (
                <div
                    role="status"
                    className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive font-medium"
                >
                    {oauthErrorMessage}
                </div>
            )}

            {/* 1. GitHub Connection Section */}
            <section
                id="github-connection"
                className="rounded-lg border border-border bg-card p-6 flex flex-col gap-4"
            >
                <h2 className="text-lg font-medium text-foreground">1. GitHub Connection</h2>
                {isConnected ? (
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                                Connected as <strong className="text-primary">{githubUser}</strong>
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsDisconnectDialogOpen(true)}
                            disabled={disconnectMutation.isPending}
                        >
                            Disconnect
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground">
                            Connect your GitHub account to enable repository creation and code submissions.
                        </p>
                        <div>
                            <Button
                                onClick={handleConnectGitHub}
                                disabled={connectMutation.isPending || isConnLoading}
                            >
                                {connectMutation.isPending ? 'Connecting…' : 'Connect GitHub'}
                            </Button>
                        </div>
                    </div>
                )}
            </section>

            {/* 2. Repository Creation Section */}
            <section className="rounded-lg border border-border bg-card p-6 flex flex-col gap-4">
                <h2 className="text-lg font-medium text-foreground">2. Starter Repository</h2>

                {isFormBlocked && (
                    <div
                        role="status"
                        className="rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-foreground font-medium"
                    >
                        {!isConnected ? (
                            <>
                                Connect GitHub to create your repository.{' '}
                                <a
                                    href="#github-connection"
                                    className="text-primary underline underline-offset-4 hover:text-primary/90"
                                >
                                    Connect GitHub
                                </a>
                            </>
                        ) : (
                            <>
                                An active subscription is required.{' '}
                                <Link
                                    to="/billing"
                                    className="text-primary underline underline-offset-4 hover:text-primary/90"
                                >
                                    Billing
                                </Link>
                            </>
                        )}
                    </div>
                )}

                {connection?.repo ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-foreground">Starter repository created successfully:</p>
                        {repoUrl && (
                            <a
                                href={repoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary font-medium text-sm underline underline-offset-4 hover:text-primary/90"
                            >
                                {connection.repo.fullName}
                            </a>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit as any)} noValidate className="flex flex-col gap-4">
                        <fieldset disabled={isFormBlocked || createRepoMutation.isPending} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="starterTemplate">Starter Template</Label>
                                <select
                                    id="starterTemplate"
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    {...register('starterTemplate')}
                                >
                                    <option value="react">React</option>
                                    <option value="node_express">Node / Express</option>
                                    <option value="django">Django</option>
                                </select>
                                {errors.starterTemplate && (
                                    <p className="text-xs text-destructive">{errors.starterTemplate.message as string}</p>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="repoName">Repository Name (optional)</Label>
                                <Input
                                    id="repoName"
                                    type="text"
                                    placeholder="worksim-starter"
                                    aria-describedby={errors.repoName ? 'repoName-error' : undefined}
                                    aria-invalid={errors.repoName ? 'true' : 'false'}
                                    {...register('repoName')}
                                />
                                {errors.repoName && (
                                    <p id="repoName-error" className="text-xs text-destructive">
                                        {errors.repoName.message as string}
                                    </p>
                                )}
                            </div>

                            <FormRootError message={errors.root?.message} />

                            <SubmitButton
                                isPending={createRepoMutation.isPending}
                                pendingLabel="Creating repository…"
                                disabled={isFormBlocked}
                                className="w-full mt-2"
                            >
                                Create Repository
                            </SubmitButton>
                        </fieldset>
                    </form>
                )}
            </section>

            {/* Disconnect Dialog */}
            <ConfirmDialog
                open={isDisconnectDialogOpen}
                onOpenChange={setIsDisconnectDialogOpen}
                title="Disconnect GitHub"
                description="Are you sure you want to disconnect your GitHub account?"
                confirmLabel="Confirm Disconnect"
                cancelLabel="Cancel"
                destructive
                isPending={disconnectMutation.isPending}
                errorMessage={disconnectError}
                onConfirm={handleConfirmDisconnect}
            />
        </div>
    );
}