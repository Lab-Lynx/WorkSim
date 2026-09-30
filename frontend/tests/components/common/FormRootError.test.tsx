import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FormRootError from '@/components/common/FormRootError';

describe('FormRootError', () => {
  it('renders nothing when no message is provided', () => {
    const { container: container1 } = render(<FormRootError />);
    expect(container1).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    const { container: container2 } = render(<FormRootError message={null} />);
    expect(container2).toBeEmptyDOMElement();

    const { container: container3 } = render(<FormRootError message="" />);
    expect(container3).toBeEmptyDOMElement();
  });

  it('renders the error message text when message is present', () => {
    render(<FormRootError message="Invalid login credentials" />);
    expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
  });

  it('renders with role="alert" when error message is present', () => {
    render(<FormRootError message="Server error occurred" />);
    const alertElement = screen.getByRole('alert');
    expect(alertElement).toBeInTheDocument();
    expect(alertElement).toHaveTextContent('Server error occurred');
  });

  it('renders error message as plain text and not HTML', () => {
    const htmlString = '<strong>Error:</strong> <script>alert("xss")</script>';
    const { container } = render(<FormRootError message={htmlString} />);

    expect(screen.getByText(htmlString)).toBeInTheDocument();
    expect(container.querySelector('strong')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});
