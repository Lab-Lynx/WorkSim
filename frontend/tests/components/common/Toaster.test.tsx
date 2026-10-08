import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Toaster from '@/components/common/Toaster';
import { useToast } from '@/hooks/useToast';
import { useToastStore } from '@/store/toast.store';

describe('Toaster', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows error toasts as alerts and success toasts as status messages', () => {
    render(<Toaster />);
    const { toast } = useToast();

    act(() => {
      toast.error('Could not save');
      toast.success('Saved');
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('dismisses a toast when the close button is used', () => {
    render(<Toaster />);

    act(() => {
      useToast().toast.error('Something failed');
    });
    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));

    expect(screen.queryByText('Something failed')).not.toBeInTheDocument();
  });

  it('removes toasts automatically after a timeout', () => {
    vi.useFakeTimers();
    render(<Toaster />);

    act(() => {
      useToast().toast.success('Done');
    });
    expect(screen.getByText('Done')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('keeps at most three toasts visible', () => {
    render(<Toaster />);

    act(() => {
      const { toast } = useToast();
      for (const message of ['one', 'two', 'three', 'four']) toast.success(message);
    });

    expect(screen.queryByText('one')).not.toBeInTheDocument();
    expect(screen.getByText('four')).toBeInTheDocument();
  });
});
