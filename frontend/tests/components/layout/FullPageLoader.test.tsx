import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FullPageLoader from '../../../src/components/layout/FullPageLoader';

describe('FullPageLoader', () => {
  it('renders accessible status role and default loading text', () => {
    render(<FullPageLoader />);

    // Renders accessible status/loading container for screen readers
    const statusElement = screen.getByRole('status');
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveTextContent(/loading/i);
  });

  it('renders the full-page container layout', () => {
    const { container } = render(<FullPageLoader />);
    const wrapper = container.firstChild as HTMLElement;

    expect(wrapper).toHaveClass('fixed', 'inset-0');
  });
});
