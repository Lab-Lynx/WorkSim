import { render, renderHook, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom';
import { useDocumentTitle, useFocusPageHeading } from '@/hooks/useDocumentTitle';

describe('useDocumentTitle and useFocusPageHeading hooks (doc 10 §10.13; doc 11 §11.2.10 & §11.9)', () => {
  describe('useDocumentTitle', () => {
    const originalTitle = document.title;

    beforeEach(() => {
      document.title = 'Initial Title';
    });

    afterEach(() => {
      document.title = originalTitle;
    });

    it('useDocumentTitle — sets document title to "{title} · Work Simulator" on mount and updates on change', () => {
      const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
        initialProps: { title: 'Create account' },
      });

      expect(document.title).toBe('Create account · Work Simulator');

      rerender({ title: 'Log in' });
      expect(document.title).toBe('Log in · Work Simulator');
    });

    it('useDocumentTitle — trims whitespace around title', () => {
      renderHook(() => useDocumentTitle('  Dashboard  '));
      expect(document.title).toBe('Dashboard · Work Simulator');
    });

    it('useDocumentTitle — falls back to "Work Simulator" when title is empty or whitespace', () => {
      renderHook(() => useDocumentTitle('   '));
      expect(document.title).toBe('Work Simulator');

      renderHook(() => useDocumentTitle(''));
      expect(document.title).toBe('Work Simulator');
    });
  });

  describe('useFocusPageHeading', () => {
    function TestLayoutHarness() {
      const navigate = useNavigate();
      const location = useLocation();

      useFocusPageHeading();

      return (
        <div>
          <nav>
            <button onClick={() => navigate('/other')}>Navigate to /other</button>
            <button onClick={() => navigate(`${location.pathname}?search=param`)}>
              Change search only
            </button>
            <button onClick={() => navigate(`${location.pathname}#hash-target`)}>
              Change hash only
            </button>
            <button onClick={() => navigate('/no-heading')}>Navigate to /no-heading</button>
            <button onClick={() => navigate('/multiple-headings')}>
              Navigate to /multiple-headings
            </button>
          </nav>
          <main>
            {location.pathname === '/' && <h1 tabIndex={-1}>Home Heading</h1>}
            {location.pathname === '/other' && <h1 tabIndex={-1}>Other Heading</h1>}
            {location.pathname === '/no-heading' && <p>No heading in this page</p>}
            {location.pathname === '/multiple-headings' && (
              <>
                <h1 tabIndex={-1} data-testid="first-h1">First Heading</h1>
                <h1 tabIndex={-1} data-testid="second-h1">Second Heading</h1>
              </>
            )}
          </main>
        </div>
      );
    }

    it('does not focus main h1 on first load / initial mount (Doc 10 §10.13)', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <TestLayoutHarness />
        </MemoryRouter>
      );

      const heading = screen.getByRole('heading', { level: 1, name: 'Home Heading' });
      expect(document.activeElement).not.toBe(heading);
    });

    it('focuses the first h1 inside main on pathname change (Doc 10 §10.13)', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <TestLayoutHarness />
        </MemoryRouter>
      );

      const homeHeading = screen.getByRole('heading', { level: 1, name: 'Home Heading' });
      expect(document.activeElement).not.toBe(homeHeading);

      const navButton = screen.getByRole('button', { name: 'Navigate to /other' });
      fireEvent.click(navButton);

      const otherHeading = screen.getByRole('heading', { level: 1, name: 'Other Heading' });
      expect(document.activeElement).toBe(otherHeading);
    });

    it('does not focus or steal focus on search-only change (Doc 10 §10.13)', () => {
      render(
        <MemoryRouter initialEntries={['/other']}>
          <TestLayoutHarness />
        </MemoryRouter>
      );

      const searchButton = screen.getByRole('button', { name: 'Change search only' });
      // Focus button explicitly
      searchButton.focus();
      expect(document.activeElement).toBe(searchButton);

      // Trigger search query param change
      fireEvent.click(searchButton);

      // Focus should remain on the button, NOT stolen by main h1
      expect(document.activeElement).toBe(searchButton);
    });

    it('does not focus or steal focus on hash-only change (Doc 10 §10.13)', () => {
      render(
        <MemoryRouter initialEntries={['/other']}>
          <TestLayoutHarness />
        </MemoryRouter>
      );

      const hashButton = screen.getByRole('button', { name: 'Change hash only' });
      hashButton.focus();
      expect(document.activeElement).toBe(hashButton);

      fireEvent.click(hashButton);

      // Focus should remain on the button, NOT stolen by main h1
      expect(document.activeElement).toBe(hashButton);
    });

    it('does nothing gracefully when there is no h1 in main (Doc 10 §10.13)', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <TestLayoutHarness />
        </MemoryRouter>
      );

      const navButton = screen.getByRole('button', { name: 'Navigate to /no-heading' });
      expect(() => fireEvent.click(navButton)).not.toThrow();

      expect(screen.getByText('No heading in this page')).toBeInTheDocument();
    });

    it('focuses the first h1 when multiple h1s exist in main (Doc 10 §10.13)', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <TestLayoutHarness />
        </MemoryRouter>
      );

      const navButton = screen.getByRole('button', { name: 'Navigate to /multiple-headings' });
      fireEvent.click(navButton);

      const firstHeading = screen.getByTestId('first-h1');
      const secondHeading = screen.getByTestId('second-h1');

      expect(document.activeElement).toBe(firstHeading);
      expect(document.activeElement).not.toBe(secondHeading);
    });
  });
});
