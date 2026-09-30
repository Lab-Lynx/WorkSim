import { describe, expect, it } from 'vitest';
import {
  abandonTicketParamsSchema,
  getTicketParamsSchema,
  startTicketParamsSchema,
} from '../../src/validators/ticket.validators.js';

const validId = '11111111-1111-4111-8111-111111111111';

describe('ticket.validators', () => {
  it.each([
    ['get', getTicketParamsSchema],
    ['start', startTicketParamsSchema],
    ['abandon', abandonTicketParamsSchema],
  ] as const)('%s accepts a UUID ticketId', async (_label, schema) => {
    const parsed = await schema.parseAsync({ params: { ticketId: validId } });
    expect(parsed.params.ticketId).toBe(validId);
  });

  it('rejects a non-UUID ticketId', async () => {
    await expect(
      getTicketParamsSchema.parseAsync({ params: { ticketId: 'not-a-uuid' } }),
    ).rejects.toBeTruthy();
  });
});
