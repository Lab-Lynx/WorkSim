import { describe, expect, it } from 'vitest';
import { formatAmount, formatDate, formatDateTime, formatScore } from '@/lib/format';

describe('format helpers', () => {
  describe('formatDate', () => {
    it('formats a valid ISO date in the browser timezone', () => {
      expect(formatDate('2026-09-19T14:05:00.000Z')).toMatch(/19 Sep 2026|18 Sep 2026/);
    });

    it.each(['', 'not-a-date', null, undefined])(
      'returns an em dash for invalid date %j',
      (value) => {
        expect(formatDate(value)).toBe('—');
      }
    );
  });

  describe('formatDateTime', () => {
    it('formats a valid ISO date with 24-hour time', () => {
      expect(formatDateTime('2026-09-19T14:05:00.000Z')).toMatch(
        /19 Sep 2026, 14:05|18 Sep 2026, 14:05/
      );
    });

    it.each(['', 'not-a-date', null, undefined])(
      'returns an em dash for invalid date %j',
      (value) => {
        expect(formatDateTime(value)).toBe('—');
      }
    );
  });

  describe('formatAmount', () => {
    it('preserves the API decimal string and appends the currency code', () => {
      expect(formatAmount('499.00', 'ETB')).toBe('499.00 ETB');
      expect(formatAmount('0001.2300', 'USD')).toBe('0001.2300 USD');
    });
  });

  describe('formatScore', () => {
    it.each([
      [0, '0'],
      [42, '42'],
      [42.5, '42.5'],
      [100.04, '100'],
      [100.05, '100.1'],
      [-1.25, '-1.3'],
    ])('formats %j for display without rubric arithmetic', (value, expected) => {
      expect(formatScore(value)).toBe(expected);
    });
  });
});
