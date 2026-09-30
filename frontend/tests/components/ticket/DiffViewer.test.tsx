import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DiffViewer } from '@/components/ticket/DiffViewer';

describe('DiffViewer', () => {
    it('renders a diff string as text in a labeled scrollable region', () => {
        render(<DiffViewer diff={'@@ -1 +1 @@\r\n-old value\r\n+<script>new value</script>'} />);

        expect(screen.getByRole('region', { name: 'Diff' })).toBeInTheDocument();
        expect(screen.getByText('-old value')).toBeInTheDocument();
        expect(screen.getByText('+<script>new value</script>')).toBeInTheDocument();
    });

    it('renders fallback state when no diffs are provided', () => {
        render(<DiffViewer diff="" />);
        expect(screen.getByText('No changes in this diff.')).toBeInTheDocument();
    });

    it('preserves diff prefixes, hunk headers, and whitespace', () => {
        const { container } = render(
            <DiffViewer diff={'@@ -1 +1 @@\n context line\n-deleted line\n+added line'} />
        );

        expect(screen.getByText('@@ -1 +1 @@')).toBeInTheDocument();
        expect(screen.getByText('-deleted line')).toBeInTheDocument();
        expect(screen.getByText('+added line')).toBeInTheDocument();
        expect(container.querySelector('pre')?.textContent).toContain(' context line');
    });

    it('renders HTML-like diff content as text', () => {
        render(<DiffViewer diff="+<script>alert(1)</script>" />);

        expect(screen.getByText('+<script>alert(1)</script>')).toBeInTheDocument();
        expect(document.querySelector('script')).toBeNull();
    });

    it('provides a keyboard-focusable diff region', () => {
        render(<DiffViewer diff="+new value" />);
        expect(screen.getByRole('region', { name: 'Diff' })).toHaveAttribute('tabindex', '0');
    });
});