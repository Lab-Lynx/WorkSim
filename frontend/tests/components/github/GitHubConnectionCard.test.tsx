import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GitHubConnectionCard, {
    GITHUB_PERMISSIONS_TEXT,
} from '@/components/github/GitHubConnectionCard';
import * as useGitHubConnectionModule from '@/hooks/github/useGitHubConnection';
import * as useGitHubConnectModule from '@/hooks/github/useGitHubConnect';
import * as useDisconnectGitHubModule from '@/hooks/github/useDisconnectGitHub';

vi.mock('@/hooks/github/useGitHubConnection');
vi.mock('@/hooks/github/useGitHubConnect');
vi.mock('@/hooks/github/useDisconnectGitHub');

describe('GitHubConnectionCard', () => {
    const mockConnectMutateAsync = vi.fn();
    const mockDisconnectMutateAsync = vi.fn();
    const mockAssign = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: { connected: false, githubLogin: null, repo: null },
            isLoading: false,
            isError: false,
            error: null,
        } as ReturnType<typeof useGitHubConnectionModule.useGitHubConnection>);

        vi.spyOn(useGitHubConnectModule, 'useGitHubConnect').mockReturnValue({
            mutateAsync: mockConnectMutateAsync,
            isPending: false,
            isError: false,
            error: null,
        } as unknown as ReturnType<typeof useGitHubConnectModule.useGitHubConnect>);

        vi.spyOn(useDisconnectGitHubModule, 'useDisconnectGitHub').mockReturnValue({
            mutateAsync: mockDisconnectMutateAsync,
            isPending: false,
            isError: false,
            error: null,
        } as unknown as ReturnType<typeof useDisconnectGitHubModule.useDisconnectGitHub>);

        Object.defineProperty(window, 'location', {
            writable: true,
            value: { assign: mockAssign, href: '' },
        });
    });

    it('renders permission text from constant', () => {
        render(
            <MemoryRouter>
                <GitHubConnectionCard hasAccess={true} />
            </MemoryRouter>
        );

        expect(screen.getByText(GITHUB_PERMISSIONS_TEXT)).toBeInTheDocument();
    });

    it('disables connect button when hasAccess is false and shows subscription reason with billing link', () => {
        render(
            <MemoryRouter>
                <GitHubConnectionCard hasAccess={false} />
            </MemoryRouter>
        );

        const button = screen.getByRole('button', { name: /connect github/i });
        expect(button).toBeDisabled();

        expect(screen.getByText(/an active subscription is required\./i)).toBeInTheDocument();
        const billingLink = screen.getByRole('link', { name: /billing/i });
        expect(billingLink).toHaveAttribute('href', '/billing');
    });

    it('redirects to OAuth URL on successful connection attempt', async () => {
        mockConnectMutateAsync.mockResolvedValueOnce(
            'https://github.com/login/oauth/authorize?state=xyz'
        );

        render(
            <MemoryRouter>
                <GitHubConnectionCard hasAccess={true} />
            </MemoryRouter>
        );

        const button = screen.getByRole('button', { name: /connect github/i });
        fireEvent.click(button);

        expect(mockConnectMutateAsync).toHaveBeenCalled();
    });

    it('shows pending label while connecting', () => {
        vi.spyOn(useGitHubConnectModule, 'useGitHubConnect').mockReturnValue({
            mutateAsync: mockConnectMutateAsync,
            isPending: true,
            isError: false,
            error: null,
        } as unknown as ReturnType<typeof useGitHubConnectModule.useGitHubConnect>);

        render(
            <MemoryRouter>
                <GitHubConnectionCard hasAccess={true} />
            </MemoryRouter>
        );

        expect(screen.getByText(/redirecting to github…/i)).toBeInTheDocument();
    });

    it('renders success alert with role="status" when connected', () => {
        vi.spyOn(useGitHubConnectionModule, 'useGitHubConnection').mockReturnValue({
            data: { connected: true, githubLogin: 'octocat', repo: null },
            isLoading: false,
            isError: false,
            error: null,
        } as ReturnType<typeof useGitHubConnectionModule.useGitHubConnection>);

        render(
            <MemoryRouter>
                <GitHubConnectionCard hasAccess={true} />
            </MemoryRouter>
        );

        const alert = screen.getByRole('status');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/connected as @octocat/i);
    });

    it('renders error alert with role="alert" without echoing unknown reason strings', () => {
        vi.spyOn(useGitHubConnectModule, 'useGitHubConnect').mockReturnValue({
            mutateAsync: mockConnectMutateAsync,
            isPending: false,
            isError: true,
            error: new Error('raw_untrusted_reason_string'),
        } as unknown as ReturnType<typeof useGitHubConnectModule.useGitHubConnect>);

        render(
            <MemoryRouter>
                <GitHubConnectionCard hasAccess={true} />
            </MemoryRouter>
        );

        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).not.toHaveTextContent('raw_untrusted_reason_string');
        expect(alert).toHaveTextContent(/failed to connect to github/i);
    });
});