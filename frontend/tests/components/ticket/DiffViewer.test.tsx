import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { FileDiff } from '@/components/ticket/DiffViewer';
import { DiffViewer } from '@/components/ticket/DiffViewer';

const mockDiffs: FileDiff[] = [
    {
        filename: 'src/index.ts',
        additions: 2,
        deletions: 1,
        patch: `@@ -1,3 +1,4 @@\n context line\n-deleted line\n+added line 1\n+added line 2`,
    },
    {
        filename: 'src/utils.ts',
        additions: 1,
        deletions: 0,
        patch: `@@ -1,1 +1,2 @@\n const a = 1;\n+const b = 2;`,
    },
];

describe('DiffViewer', () => {
    it('renders fallback state when no diffs are provided', () => {
        render(<DiffViewer diffs={[]} />);
        expect(screen.getByText('No changes to display.')).toBeInTheDocument();
    });

    it('renders list of modified files with additions and deletions count', () => {
        render(<DiffViewer diffs={mockDiffs} />);

        expect(screen.getByText('src/index.ts')).toBeInTheDocument();
        expect(screen.getByText('src/utils.ts')).toBeInTheDocument();
        expect(screen.getByText('+2')).toBeInTheDocument();
        expect(screen.getByText('-1')).toBeInTheDocument();
    });

    it('toggles file collapse state on header click', () => {
        render(<DiffViewer diffs={mockDiffs} />);

        expect(screen.getByText('deleted line')).toBeInTheDocument();

        const fileHeader = screen.getByText('src/index.ts');
        fireEvent.click(fileHeader);

        expect(screen.queryByText('deleted line')).not.toBeInTheDocument();

        fireEvent.click(fileHeader);
        expect(screen.getByText('deleted line')).toBeInTheDocument();
    });

    it('switches between unified and split view modes', () => {
        render(<DiffViewer diffs={mockDiffs} />);

        const splitBtn = screen.getByRole('button', { name: /split/i });
        const unifiedBtn = screen.getByRole('button', { name: /unified/i });

        fireEvent.click(splitBtn);
        expect(splitBtn).toHaveClass('bg-white');

        fireEvent.click(unifiedBtn);
        expect(unifiedBtn).toHaveClass('bg-white');
    });
});