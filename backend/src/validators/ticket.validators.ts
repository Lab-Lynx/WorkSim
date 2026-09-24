import { z } from 'zod';

const ticketIdParam = z.object({
  ticketId: z.string().uuid('ticketId must be a valid UUID'),
});

/** EP-25 — GET /tickets/:ticketId */
export const getTicketParamsSchema = z.object({
  params: ticketIdParam,
});

/** EP-26 — POST /tickets/:ticketId/start */
export const startTicketParamsSchema = z.object({
  params: ticketIdParam,
});

/** EP-27 — POST /tickets/:ticketId/abandon */
export const abandonTicketParamsSchema = z.object({
  params: ticketIdParam,
});
