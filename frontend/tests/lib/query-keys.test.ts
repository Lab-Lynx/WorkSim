import { describe, expect, it } from 'vitest';
import { queryKeys } from '@/lib/query-keys';

describe('queryKeys', () => {
  it('defines the documented constant tuples', () => {
    expect(queryKeys.me).toEqual(['me']);
    expect(queryKeys.subscription).toEqual(['subscription']);
    expect(queryKeys.payments).toEqual(['payments']);
    expect(queryKeys.githubConnection).toEqual(['github-connection']);
    expect(queryKeys.currentTicket).toEqual(['ticket', 'current']);
    expect(queryKeys.profile).toEqual(['profile']);
  });

  it('creates ticket, mentor, and submission keys without losing arguments', () => {
    expect(queryKeys.ticket('ticket-123')).toEqual(['ticket', 'ticket-123']);
    expect(queryKeys.mentor('ticket-123')).toEqual(['mentor', 'ticket-123']);
    expect(queryKeys.submission('ticket-123', 2, true)).toEqual([
      'submission',
      'ticket-123',
      2,
      true,
    ]);
  });

  it('does not define the bare ticket prefix as an invalidation key', () => {
    expect(queryKeys).not.toHaveProperty('ticketPrefix');
    expect(queryKeys.currentTicket).not.toEqual(['ticket']);
  });
});
