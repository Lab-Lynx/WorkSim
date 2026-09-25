import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { CopyButton, COPY_FEEDBACK_MS } from '@/components/common/CopyButton';

describe('CopyButton', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('renders accessible copy button with initial label', () => {
    render(<CopyButton text="git checkout -b feat/test" label="Copy git command" />);

    const button = screen.getByRole('button', { name: 'Copy git command' });
    expect(button).toBeInTheDocument();
  });

  it('copies text and announces Copied for COPY_FEEDBACK_MS upon successful copy', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CopyButton text="git checkout -b feat/test" label="Copy git command" />);

    const button = screen.getByRole('button', { name: 'Copy git command' });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeTextMock).toHaveBeenCalledWith('git checkout -b feat/test');

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent('Copied');

    // Advance time up to COPY_FEEDBACK_MS
    act(() => {
      vi.advanceTimersByTime(COPY_FEEDBACK_MS - 100);
    });
    expect(liveRegion).toHaveTextContent('Copied');

    // Advance time past COPY_FEEDBACK_MS
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(liveRegion).toHaveTextContent('');
  });

  it('handles rejected clipboard API gracefully without throwing', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<CopyButton text="git checkout -b feat/test" label="Copy git command" />);

    const button = screen.getByRole('button', { name: 'Copy git command' });

    await act(async () => {
      expect(() => fireEvent.click(button)).not.toThrow();
    });

    expect(writeTextMock).toHaveBeenCalledWith('git checkout -b feat/test');

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent('Failed to copy');
  });

  it('handles missing navigator.clipboard gracefully without throwing', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    render(<CopyButton text="git checkout -b feat/test" label="Copy git command" />);

    const button = screen.getByRole('button', { name: 'Copy git command' });

    await act(async () => {
      expect(() => fireEvent.click(button)).not.toThrow();
    });

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent('Failed to copy');
  });

  it('cleans up timeout timer on unmount', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const { unmount } = render(
      <CopyButton text="git checkout -b feat/test" label="Copy git command" />
    );

    const button = screen.getByRole('button', { name: 'Copy git command' });

    await act(async () => {
      fireEvent.click(button);
    });

    unmount();

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(COPY_FEEDBACK_MS);
      });
    }).not.toThrow();
  });
});
