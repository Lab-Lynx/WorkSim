/** Re-export the real hook so callers never hit the old stub. */
export {
  useCurrentTicket,
  type Ticket,
  type UseCurrentTicketOptions,
} from '@/hooks/tickets/useCurrentTicket';
