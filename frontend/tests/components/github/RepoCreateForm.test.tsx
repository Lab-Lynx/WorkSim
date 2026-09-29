import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RepoCreateForm from '@/components/github/RepoCreateForm';
import { useCreateRepo } from '@/hooks/github/useCreateRepo';
import { ApiError } from '@/lib/api/errors';

vi.mock('@/hooks/github/useCreateRepo');

describe('RepoCreateForm', () => {
    const mockMutate = vi.fn();
    const mockOnSuccess = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useCreateRepo as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            mutate: mockMutate,
            isPending: false,
        });
    });

    it('renders all starter template radio options and repo name input', () => {
        render(<RepoCreateForm onSuccess={mockOnSuccess} />);

        expect(screen.getByLabelText(/react/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/node/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/django/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/repository name/i)).toBeInTheDocument();
    });

    it('shows validation error when no starter template is selected', async () => {
        render(<RepoCreateForm onSuccess={mockOnSuccess} />);

        const submitBtn = screen.getByRole('button', { name: /create repository/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText(/choose a starter template/i)).toBeInTheDocument();
        });
        expect(mockMutate).not.toHaveBeenCalled();
    });

    it('shows validation error when repository name contains invalid characters', async () => {
        render(<RepoCreateForm onSuccess={mockOnSuccess} />);

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
        expect(mockMutate).not.toHaveBeenCalled();
    });

    it('submits successfully with template and optional repository name', async () => {
        mockMutate.mockImplementation((_data, options) => {
            options?.onSuccess?.({ id: '123', name: 'my-custom-repo' });
        });

        render(<RepoCreateForm onSuccess={mockOnSuccess} />);

        fireEvent.click(screen.getByLabelText(/react/i));
        fireEvent.change(screen.getByLabelText(/repository name/i), {
            target: { value: 'my-custom-repo' },
        });

        const submitBtn = screen.getByRole('button', { name: /create repository/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockMutate).toHaveBeenCalledWith(
                { starterTemplate: 'react', repoName: 'my-custom-repo' },
                expect.any(Object)
            );
        });

        expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('displays root error when server returns an API error', async () => {
        const serverError = new ApiError(400, 'Repository creation failed on server', 'api');

        mockMutate.mockImplementation((_data, options) => {
            options?.onError?.(serverError);
        });

        render(<RepoCreateForm onSuccess={mockOnSuccess} />);

        fireEvent.click(screen.getByLabelText(/react/i));
        fireEvent.click(screen.getByRole('button', { name: /create repository/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Repository creation failed on server');
        });
    });

    it('disables submit button and shows pending state during submission', () => {
        (useCreateRepo as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            mutate: mockMutate,
            isPending: true,
        });

        render(<RepoCreateForm onSuccess={mockOnSuccess} />);

        const submitBtn = screen.getByRole('button', { name: /creating\.\.\./i });
        expect(submitBtn).toBeDisabled();
    });
});