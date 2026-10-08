import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import GitHubSetupPage from '@/pages/github/GitHubSetupPage';
import * as useGitHubConnectionModule from '@/hooks/github/useGitHubConnection';
import * as useGitHubConnectModule from '@/hooks/github/useGitHubConnect';
import * as useDisconnectGitHubModule from '@/hooks/github/useDisconnectGitHub';
import * as useCreateRepoModule from '@/hooks/github/useCreateRepo';
import * as useSubscriptionModule from '@/hooks/billing/useSubscription';

vi.mock('@/hooks/github/useGitHubConnection');
vi.mock('@/hooks/github/useGitHubConnect');
vi.mock('@/hooks/github/useDisconnectGitHub');
vi.mock('@/hooks/github/useCreateRepo');
vi.mock('@/hooks/billing/useSubscription');
vi.mock('@/hooks/submissions/useSubmissions', () => ({
    useSubmissions: () => ({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
    }),
}));
vi.mock('@/hooks/useDocumentTitle', () => ({
    useDocumentTitle: vi.fn(),
}));

describe('GitHubSetupPage', () => {
    const mockRefetchConnection = vi.fn();
    const mockConnectMutateAsync = vi.fn();
    const mockDisconnectMutateAsync = vi.fn();
    const mockCreateRepoMutateAsync = vi.fn();

    const defaultConnectionData = {
        connected: false,
        githubUsername: null,
        repo: null,
    };

    const defaultSubscriptionData = {
        hasAccess: true,
        status: 'active',
    };

    function SearchDisplay() {
        return <span data-testid="current-search">{useLocation().search}</span>;
    }

    beforeEach(() => {
        vi.clearAllMocks();

        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: defaultConnectionData,
            isLoading: false,
            error: null,
            refetch: mockRefetchConnection,
        } as never);

        vi.spyOn(useGitHubConnectModule, 'useGitHubConnect').mockReturnValue({
            mutateAsync: mockConnectMutateAsync,
            isPending: false,
            error: null,
        } as never);

        vi.spyOn(useDisconnectGitHubModule, 'useDisconnectGitHub').mockReturnValue({
            mutateAsync: mockDisconnectMutateAsync,
            isPending: false,
            error: null,
        } as never);

        vi.spyOn(useCreateRepoModule, 'useCreateRepo').mockReturnValue({
            mutateAsync: mockCreateRepoMutateAsync,
            isPending: false,
            error: null,
        } as never);

        vi.spyOn(useSubscriptionModule, 'useSubscription').mockReturnValue({
            data: defaultSubscriptionData,
            isLoading: false,
        } as never);
    });

    const renderPage = (initialEntries = ['/github/setup']) => {
        return render(
            <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                    <Route
                        path="/github/setup"
                        element={<><GitHubSetupPage /><SearchDisplay /></>}
                    />
                </Routes>
            </MemoryRouter>
        );
    };

    it('renders OAuth error notice when ?github=error&reason=exchange_failed is present in query params', () => {
        renderPage(['/github/setup?github=error&reason=exchange_failed']);

        // Targeted lookup by text content to handle multiple status banners
        expect(
            screen.getByText("Couldn't connect to GitHub. Try again.")
        ).toBeInTheDocument();
    });

    it('removes only OAuth callback parameters while preserving unrelated query values', async () => {
        renderPage(['/github/setup?github=error&reason=exchange_failed&tab=repository']);

        await waitFor(() => {
            expect(screen.getByTestId('current-search')).toHaveTextContent('?tab=repository');
        });
    });

    it('shows blocked notice "Connect GitHub to create your repository." when GitHub is not connected', () => {
        renderPage();
        expect(
            screen.getByText(/Connect GitHub to create your repository\./i)
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Connect GitHub' })).toHaveAttribute(
            'href',
            '#github-connection'
        );
    });

    it('allows user without subscription to access repository creation once GitHub is connected', () => {
        vi.spyOn(useSubscriptionModule, 'useSubscription').mockReturnValue({
            data: { hasAccess: false, status: 'canceled' },
            isLoading: false,
        } as never);
        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: { connected: true, githubUsername: 'octocat', repo: null },
            isLoading: false,
            refetch: mockRefetchConnection,
        } as never);

        renderPage();
        expect(
            screen.queryByText(/An active subscription is required\./i)
        ).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create repository/i })).toBeInTheDocument();
    });

    it('handles disconnect flow with ConfirmDialog when user clicks Disconnect', async () => {
        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: { connected: true, githubUsername: 'octocat', repo: null },
            isLoading: false,
            refetch: mockRefetchConnection,
        } as never);
        mockDisconnectMutateAsync.mockResolvedValueOnce(undefined);

        renderPage();

        const disconnectBtn = screen.getByRole('button', { name: /disconnect/i });

        await act(async () => {
            fireEvent.click(disconnectBtn);
        });

        // Confirm dialog opens
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();

        const confirmBtn = screen.getByRole('button', { name: /^disconnect$/i });

        await act(async () => {
            fireEvent.click(confirmBtn);
        });

        expect(mockDisconnectMutateAsync).toHaveBeenCalledTimes(1);
    });

    it('handles 403 on disconnect by refetching connection status', async () => {
        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: { connected: true, githubUsername: 'octocat', repo: null },
            isLoading: false,
            refetch: mockRefetchConnection,
        } as never);

        const error403 = { status: 403, kind: 'api', message: 'Forbidden action' };
        mockDisconnectMutateAsync.mockRejectedValueOnce(error403);

        renderPage();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /^disconnect$/i }));
        });

        await waitFor(() => {
            expect(mockRefetchConnection).toHaveBeenCalledTimes(1);
        });
    });

    it('submits repository creation form when connected and subscribed', async () => {
        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: { connected: true, githubUsername: 'octocat', repo: null },
            isLoading: false,
            refetch: mockRefetchConnection,
        } as never);
        mockCreateRepoMutateAsync.mockResolvedValueOnce({
            id: 1,
            fullName: 'octocat/my-starter-repo',
            htmlUrl: 'https://github.com/octocat/my-starter-repo',
        });

        renderPage();

        const repoInput = screen.getByLabelText(/repository name/i);
        fireEvent.click(screen.getByLabelText(/react/i));

        await act(async () => {
            fireEvent.change(repoInput, { target: { value: 'my-starter-repo' } });
        });

        const submitBtn = screen.getByRole('button', { name: /create repository/i });

        await act(async () => {
            fireEvent.click(submitBtn);
        });

        await waitFor(() => {
            expect(mockCreateRepoMutateAsync).toHaveBeenCalledWith({
                starterTemplate: 'react',
                repoName: 'my-starter-repo',
            });
        });
    });

    it('renders "Continue working" and "Create repo" buttons when repository is already created', () => {
        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: {
                connected: true,
                githubUsername: 'octocat',
                repo: {
                    fullName: 'octocat/work-simulator',
                    starterTemplate: 'react',
                    defaultBranch: 'main',
                },
            },
            isLoading: false,
            refetch: mockRefetchConnection,
        } as never);

        renderPage();

        const continueBtn = screen.getByRole('link', { name: /continue working/i });
        expect(continueBtn).toBeInTheDocument();
        expect(continueBtn).toHaveAttribute('href', '/tickets');

        const createRepoBtn = screen.getByRole('button', { name: /create repo/i });
        expect(createRepoBtn).toBeInTheDocument();
    });

    it('toggles repo creation form when user clicks "Create repo" and can cancel back', async () => {
        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: {
                connected: true,
                githubUsername: 'octocat',
                repo: {
                    fullName: 'octocat/work-simulator',
                    starterTemplate: 'react',
                    defaultBranch: 'main',
                },
            },
            isLoading: false,
            refetch: mockRefetchConnection,
        } as never);

        renderPage();

        const createRepoBtn = screen.getByRole('button', { name: /create repo/i });

        await act(async () => {
            fireEvent.click(createRepoBtn);
        });

        expect(screen.getByText(/current repository:/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create repository/i })).toBeInTheDocument();

        const cancelBtn = screen.getByRole('button', { name: /cancel/i });
        await act(async () => {
            fireEvent.click(cancelBtn);
        });

        expect(screen.queryByText(/current repository:/i)).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /continue working/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create repo/i })).toBeInTheDocument();
    });
});