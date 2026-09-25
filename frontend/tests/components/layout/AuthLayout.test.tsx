import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthLayout } from '@/components/layout/AuthLayout';

// Mock useFocusPageHeading hook
const mockUseFocusPageHeading = vi.fn();
vi.mock('../../../src/hooks/useFocusPageHeading', () => ({
  useFocusPageHeading: () => mockUseFocusPageHeading(),
}));

describe('AuthLayout', () => {
  it('renders its child content inside the centered layout card', () => {
    render(
      <AuthLayout>
        <div data-testid="test-child">Auth Form Content</div>
      </AuthLayout>
    );

    const child = screen.getByTestId('test-child');
    expect(child).toBeInTheDocument();
    expect(child).toHaveTextContent('Auth Form Content');
  });

  it('calls useFocusPageHeading on render', () => {
    render(
      <AuthLayout>
        <h1>Log in</h1>
      </AuthLayout>
    );

    expect(mockUseFocusPageHeading).toHaveBeenCalled();
  });

  it('contains no third-party scripts, images, or external links', () => {
    const { container } = render(
      <AuthLayout>
        <h1>Register</h1>
      </AuthLayout>
    );

    expect(container.querySelectorAll('script')).toHaveLength(0);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.querySelectorAll("a[href^='http']")).toHaveLength(0);
  });
});
