import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PasswordInput from '@/components/common/PasswordInput';

describe('PasswordInput', () => {
  it('starts hidden with type="password" and no prefilled value', () => {
    const { container } = render(<PasswordInput autoComplete="current-password" />);
    const input = container.querySelector('input') as HTMLInputElement;

    expect(input).toBeInTheDocument();
    expect(input.type).toBe('password');
    expect(input.value).toBe('');
    expect(input.getAttribute('autocomplete')).toBe('current-password');
  });

  it('toggles visibility between password and text when visibility button is clicked', () => {
    const { container } = render(<PasswordInput autoComplete="new-password" />);
    const input = container.querySelector('input') as HTMLInputElement;

    // Initially hidden
    const toggleButton = screen.getByRole('button', { name: 'Show password' });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    expect(input.type).toBe('password');

    // Click to show password
    fireEvent.click(toggleButton);
    expect(input.type).toBe('text');
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    // Click to hide password again
    fireEvent.click(toggleButton);
    expect(input.type).toBe('password');
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('ensures the visibility toggle button has type="button" and does not submit forms', () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit}>
        <PasswordInput autoComplete="current-password" />
      </form>
    );

    const toggleButton = screen.getByRole('button', { name: 'Show password' });
    expect(toggleButton).toHaveAttribute('type', 'button');

    fireEvent.click(toggleButton);
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('forwards ref correctly to the underlying input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<PasswordInput ref={ref} autoComplete="current-password" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('does not modify the input value when toggling visibility', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <PasswordInput autoComplete="current-password" value="mySecret123" onChange={handleChange} />
    );
    const input = container.querySelector('input') as HTMLInputElement;

    expect(input.value).toBe('mySecret123');

    const toggleButton = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(toggleButton);

    expect(input.value).toBe('mySecret123');
  });

  it('starts hidden again when unmounted and remounted', () => {
    const { container, unmount } = render(<PasswordInput autoComplete="current-password" />);
    const toggleButton = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(toggleButton);

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('text');

    unmount();

    const { container: newContainer } = render(<PasswordInput autoComplete="current-password" />);
    const newInput = newContainer.querySelector('input') as HTMLInputElement;
    expect(newInput.type).toBe('password');
  });
});
