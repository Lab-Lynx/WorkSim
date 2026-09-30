import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RepoCreateForm from '@/components/github/RepoCreateForm';
import type { CreateRepoInput } from '@/schemas/github.schemas';
import type { UiError } from '@/lib/api/errors';

describe('RepoCreateForm', () => {
    const onSubmit = vi.fn<(values: CreateRepoInput) => Promise<void>>().mockResolvedValue(undefined);
    const baseProps = { onSubmit, isPending: false, error: null, blocked: null };

    beforeEach(() => vi.clearAllMocks());

    it('shows the supplied blocked reason and link without rendering the form', () => {
        render(
            <MemoryRouter>
                <RepoCreateForm
                    onSubmit={vi.fn().mockResolvedValue(undefined)}
                    isPending={false}
                    error={null}
                    blocked={{
                        message: 'Connect GitHub to create your repository.',
                        linkTo: '#github-connection',
                        linkLabel: 'Connect GitHub',
                    }}
                />
            </MemoryRouter>
        );

        expect(screen.getByText('Connect GitHub to create your repository.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Connect GitHub' })).toHaveAttribute(
            'href',
            '#github-connection'
        );
        expect(screen.queryByLabelText(/repository name/i)).not.toBeInTheDocument();
    });

    it('renders all templates with none selected and defaults the repository name', () => {
        render(
            <MemoryRouter>
                <RepoCreateForm {...baseProps} />
            </MemoryRouter>
        );

        expect(screen.getByLabelText(/react/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/node/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/django/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/react/i)).not.toBeChecked();
        expect(screen.getByLabelText(/repository name/i)).toHaveValue('work-simulator');
    });

    it('shows validation error when no starter template is selected', async () => {
        render(
            <MemoryRouter>
                <RepoCreateForm {...baseProps} />
            </MemoryRouter>
        );

        const submitBtn = screen.getByRole('button', { name: /create repository/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText(/choose a starter template/i)).toBeInTheDocument();
        });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('shows validation error when repository name contains invalid characters', async () => {
        render(
            <MemoryRouter>
                <RepoCreateForm {...baseProps} />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByLabelText(/react/i));
        const repoInput = screen.getByLabelText(/repository name/i);
        fireEvent.change(repoInput, { target: { value: 'invalid repo name!' } });

        const submitBtn = screen.getByRole('button', { name: /create repository/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(
                screen.getByText(/use letters, numbers, "\.", "-" and "_" only, up to 100 characters/i)
            ).toBeInTheDocument();
        });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits validated values through the parent callback', async () => {
        render(
            <MemoryRouter>
                <RepoCreateForm {...baseProps} />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByLabelText(/react/i));
        fireEvent.change(screen.getByLabelText(/repository name/i), {
            target: { value: 'my-custom-repo' },
        });

        const submitBtn = screen.getByRole('button', { name: /create repository/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(onSubmit).toHaveBeenCalledWith({
                starterTemplate: 'react',
                repoName: 'my-custom-repo',
            });
        });
    });

    it('focuses repo name for conflict errors and preserves values for retryable failures', async () => {
        const conflict: UiError = {
            status: 409,
            kind: 'api',
            message: 'Repository already exists.',
            action: 'refetch',
            isNotFound: false,
            isTimeout: false,
        };
        const { rerender } = render(
            <MemoryRouter>
                <RepoCreateForm {...baseProps} error={conflict} />
            </MemoryRouter>
        );
        await waitFor(() => expect(screen.getByLabelText(/repository name/i)).toHaveFocus());

        fireEvent.click(screen.getByLabelText(/react/i));
        fireEvent.change(screen.getByLabelText(/repository name/i), {
            target: { value: 'my-retry-repo' },
        });
        rerender(
            <MemoryRouter>
                <RepoCreateForm
                    {...baseProps}
                    error={{ ...conflict, status: 502, message: 'Gateway error.' }}
                />
            </MemoryRouter>
        );
        expect(screen.getByLabelText(/repository name/i)).toHaveValue('my-retry-repo');
    });

    it('disables fields and shows the pending label while submitting', () => {
        render(
            <MemoryRouter>
                <RepoCreateForm {...baseProps} isPending />
            </MemoryRouter>
        );

        const submitBtn = screen.getByRole('button', { name: /creating repository/i });
        expect(submitBtn).toBeDisabled();
        expect(screen.getByLabelText(/repository name/i)).toBeDisabled();
    });
});