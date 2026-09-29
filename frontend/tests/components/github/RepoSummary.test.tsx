import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RepoSummary } from '@/components/github/RepoSummary';
import { COPY_FEEDBACK_MS } from '@/components/common/CopyButton';

// Mock lib/github module functions
vi.mock('@/lib/github', () => ({
    buildRepoUrl: vi.fn((repo: string) =>
        repo.includes('/') ? `https://github.com/${repo}` : null
    ),
    buildBranchUrl: vi.fn((repo: string, branch: string) =>
        repo.includes('/') ? `https://github.com/${repo}/tree/${branch}` : null
    ),
}));

describe('RepoSummary Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders repository name as plain text when buildRepoUrl returns null', () => {
        render(<RepoSummary repositoryName="invalid-repo-format" />);

        const textElement = screen.getByText('invalid-repo-format');
        expect(textElement.tagName).not.toBe('A');
        expect(screen.queryByRole('link')).toBeNull();
    });

    it('renders external link when buildRepoUrl returns a valid URL', () => {
        render(<RepoSummary repositoryName="owner/repository-name" />);

        const link = screen.getByRole('link', { name: /owner\/repository-name/i });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://github.com/owner/repository-name');
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders starter template name when provided', () => {
        render(
            <RepoSummary
                repositoryName="owner/repository-name"
                templateName="nextjs-starter-template"
            />
        );

        expect(screen.getByText(/created from template:/i)).toBeInTheDocument();
        expect(screen.getByText('nextjs-starter-template')).toBeInTheDocument();
    });

    it('renders default branch link and command copy button', () => {
        render(
            <RepoSummary
                repositoryName="owner/repository-name"
                defaultBranch="develop"
            />
        );

        const branchLink = screen.getByRole('link', { name: /develop/i });
        expect(branchLink).toBeInTheDocument();
        expect(branchLink).toHaveAttribute('href', 'https://github.com/owner/repository-name/tree/develop');

        const copyBtn = screen.getByRole('button', { name: /copy branch command/i });
        expect(copyBtn).toBeInTheDocument();
    });

    it('handles clipboard copy interaction and status reset timer', async () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
            clipboard: {
                writeText: writeTextMock,
            },
        });

        render(
            <RepoSummary
                repositoryName="owner/repository-name"
                defaultBranch="main"
            />
        );

        const copyBtn = screen.getByRole('button', { name: /copy branch command/i });

        await act(async () => {
            fireEvent.click(copyBtn);
        });

        expect(writeTextMock).toHaveBeenCalledWith('git checkout main');
        expect(screen.getByRole('status')).toHaveTextContent('Copied');

        // Advance timers past COPY_FEEDBACK_MS to verify reset
        act(() => {
            vi.advanceTimersByTime(COPY_FEEDBACK_MS);
        });

        expect(screen.getByRole('status')).toHaveTextContent('');
    });
});