import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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

    beforeEach(() => {
        vi.clearAllMocks();

        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: defaultConnectionData,
            isLoading: false,
            error: null,
            refetch: mockRefetchConnection,
        } as any);

        vi.spyOn(useGitHubConnectModule, 'useGitHubConnect').mockReturnValue({
            mutateAsync: mockConnectMutateAsync,
            isPending: false,
            error: null,
        } as any);

        vi.spyOn(useDisconnectGitHubModule, 'useDisconnectGitHub').mockReturnValue({
            mutateAsync: mockDisconnectMutateAsync,
            isPending: false,
            error: null,
        } as any);

        vi.spyOn(useCreateRepoModule, 'useCreateRepo').mockReturnValue({
            mutateAsync: mockCreateRepoMutateAsync,
            isPending: false,
            error: null,
        } as any);

        vi.spyOn(useSubscriptionModule, 'useSubscription').mockReturnValue({
            data: defaultSubscriptionData,
            isLoading: false,
        } as any);
    });

    const renderPage = (initialEntries = ['/github/setup']) => {
        return render(
            <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                    <Route path="/github/setup" element={<GitHubSetupPage />} />
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

    it('shows blocked notice "An active subscription is required." when user lacks subscription access', () => {
        vi.spyOn(useSubscriptionModule, 'useSubscription').mockReturnValue({
            data: { hasAccess: false, status: 'canceled' },
            isLoading: false,
        } as any);
        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: { connected: true, githubUsername: 'octocat', repo: null },
            isLoading: false,
            refetch: mockRefetchConnection,
        } as any);

        renderPage();
        expect(
            screen.getByText(/An active subscription is required\./i)
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute('href', '/billing');
    });

    it('handles disconnect flow with ConfirmDialog when user clicks Disconnect', async () => {
        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: { connected: true, githubUsername: 'octocat', repo: null },
            isLoading: false,
            refetch: mockRefetchConnection,
        } as any);
        mockDisconnectMutateAsync.mockResolvedValueOnce(undefined);

        renderPage();

        const disconnectBtn = screen.getByRole('button', { name: /disconnect/i });

        await act(async () => {
            fireEvent.click(disconnectBtn);
        });

        // Confirm dialog opens
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();

        const confirmBtn = screen.getByRole('button', { name: /confirm disconnect/i });

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
        } as any);

        const error403 = { status: 403, message: 'Forbidden action' };
        mockDisconnectMutateAsync.mockRejectedValueOnce(error403);

        renderPage();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /confirm disconnect/i }));
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
        } as any);
        mockCreateRepoMutateAsync.mockResolvedValueOnce({
            id: 1,
            fullName: 'octocat/my-starter-repo',
            htmlUrl: 'https://github.com/octocat/my-starter-repo',
        });

        renderPage();

        const repoInput = screen.getByLabelText(/repository name/i);

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
});