import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoSummary } from '@/components/github/RepoSummary';

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
    beforeEach(() => vi.clearAllMocks());

    const repo = {
        fullName: 'owner/repository-name',
        starterTemplate: 'react' as const,
        defaultBranch: 'main',
    };

    it('renders the repository object in a focusable heading', () => {
        render(<RepoSummary repo={repo} />);

        const heading = screen.getByRole('heading', { name: /owner\/repository-name/ });
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(screen.getByText('react')).toBeInTheDocument();
        expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('renders a safe external repository link', () => {
        render(<RepoSummary repo={repo} />);

        const link = screen.getByRole('link', { name: /owner\/repository-name/i });
        expect(link).toHaveAttribute('href', 'https://github.com/owner/repository-name');
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders untrusted repository names as plain text', () => {
        render(<RepoSummary repo={{ ...repo, fullName: 'invalid-repo-format' }} />);

        expect(screen.getByRole('heading', { name: 'invalid-repo-format' })).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('forwards the heading ref so the page can focus it after creation', () => {
        const ref = createRef<HTMLHeadingElement>();
        render(<RepoSummary ref={ref} repo={repo} />);

        expect(ref.current).toBe(screen.getByRole('heading', { name: /owner\/repository-name/ }));
    });
});