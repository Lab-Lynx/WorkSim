import { renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { useFocusPageHeading } from '../../src/hooks/useFocusPageHeading';
import { useFocusPageHeading as realHook } from '../../src/hooks/useDocumentTitle';

describe('useFocusPageHeading module', () => {
  it('re-exports the real hook rather than a no-op', () => {
    expect(useFocusPageHeading).toBe(realHook);
  });

  it('focuses the main heading after the route changes', () => {
    document.body.innerHTML = '<main><h1 tabindex="-1">Page</h1></main>';
    const heading = document.querySelector('h1') as HTMLElement;

    const { result } = renderHook(
      () => {
        useFocusPageHeading();
        return useNavigate();
      },
      { wrapper: ({ children }) => <MemoryRouter initialEntries={['/a']}>{children}</MemoryRouter> },
    );
    expect(document.activeElement).not.toBe(heading);

    act(() => {
      result.current('/b');
    });

    expect(document.activeElement).toBe(heading);
  });
});
