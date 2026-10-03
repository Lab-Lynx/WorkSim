import { prisma } from '../config/db.js';
import * as ticketService from '../services/ticket.service.js';
import * as ticketGeneration from '../services/ticket-generation.service.js';

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'rteklu582@gmail.com' } });
  if (!user) {
    console.log('No user found');
    return;
  }
  console.log('User:', user.id, user.email);

  // Check templates available
  const template = ticketGeneration.loadTicketTemplate('react-add-button');
  console.log('Template loaded:', template.title);

  // Check current ticket
  const current = await ticketService.getCurrentTicket(user.id);
  console.log('Current ticket:', current);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
