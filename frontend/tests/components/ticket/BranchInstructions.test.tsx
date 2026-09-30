import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BranchInstructions, { shellQuote } from '@/components/ticket/BranchInstructions';

describe('BranchInstructions (FE-091)', () => {
  it('renders safe repository and branch links with copy actions', () => {
    render(<BranchInstructions repoFullName="student/worksim" branchName="feat/settings" />);

    expect(screen.getByRole('link', { name: /student\/worksim/i })).toHaveAttribute(
      'href',
      'https://github.com/student/worksim'
    );
    expect(screen.getByRole('link', { name: /feat\/settings/ })).toHaveAttribute(
      'href',
      'https://github.com/student/worksim/tree/feat%2Fsettings'
    );
    expect(screen.getByRole('button', { name: 'Copy git fetch command' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy git checkout command' })).toBeInTheDocument();
  });

  it('quotes branch names safely for shell commands', () => {
    expect(shellQuote("feature/it's ready")).toBe("'feature/it'\\''s ready'");
    render(<BranchInstructions repoFullName="bad/name/extra" branchName="branch name" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText("git checkout 'branch name'")).toBeInTheDocument();
  });
});