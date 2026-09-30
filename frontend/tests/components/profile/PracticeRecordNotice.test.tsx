import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PracticeRecordNotice, { PRACTICE_RECORD_NOTICE_TEXT } from '@/components/profile/PracticeRecordNotice';

describe('PracticeRecordNotice (FE-096)', () => {
  it('always renders the exact practice-record notice', () => {
    render(<PracticeRecordNotice />);
    expect(screen.getByText(PRACTICE_RECORD_NOTICE_TEXT)).toBeInTheDocument();
    expect(PRACTICE_RECORD_NOTICE_TEXT).toBe(
      'This is a practice work-sample record. It is not a certified or employer-verified credential.'
    );
  });
});