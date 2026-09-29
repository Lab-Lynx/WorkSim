import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

describe('useDocumentTitle hook (doc 10 §10.15; doc 11 §11.2)', () => {
    const originalTitle = document.title;

    beforeEach(() => {
        document.title = 'Initial Title';
    });

    afterEach(() => {
        document.title = originalTitle;
    });

    it('sets document title to "{title} · Work Simulator" on mount and updates on change', () => {
        const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
            initialProps: { title: 'Create account' },
        });

        expect(document.title).toBe('Create account · Work Simulator');

        rerender({ title: 'Log in' });
        expect(document.title).toBe('Log in · Work Simulator');
    });

    it('falls back to "Work Simulator" when title is empty or whitespace', () => {
        renderHook(() => useDocumentTitle('   '));
        expect(document.title).toBe('Work Simulator');
    });
});
