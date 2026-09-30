import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import {
  serializeTicket,
  serializeSubmissionSummary,
} from '../serializers/ticket.serializer.js';
import * as ticketService from '../services/ticket.service.js';
import * as githubService from '../services/github.service.js';

const requireUser = (req: AuthRequest) => {
  if (!req.user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  }
  return req.user;
};

/** EP-23 */
export const assignTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const ticket = await ticketService.assignNextTicket(user.id);
  const repo = await githubService.getStarterRepoSummary(user.id);

  res.status(HTTP_STATUS.CREATED).json(
    new SuccessResponse(HTTP_STATUS.CREATED, 'Ticket assigned', {
      ticket: serializeTicket(ticket, repo),
    }),
  );
});

/** EP-24 */
export const currentTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const ticket = await ticketService.getCurrentTicket(user.id);
  const repo = ticket ? await githubService.getStarterRepoSummary(user.id) : null;

  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Current ticket', {
      ticket: ticket ? serializeTicket(ticket, repo) : null,
    }),
  );
});

/** EP-25 */
export const getTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const { ticketId } = req.params as { ticketId: string };
  const result = await ticketService.getTicketById(user.id, ticketId);

  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Ticket', {
      ticket: serializeTicket(result.ticket, result.repo),
      submissions: result.submissions.map((s) =>
        serializeSubmissionSummary(s, result.repo?.fullName ?? null),
      ),
    }),
  );
});

/** EP-26 */
export const startTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const { ticketId } = req.params as { ticketId: string };
  const ticket = await ticketService.startTicket(user.id, ticketId);
  const repo = await githubService.getStarterRepoSummary(user.id);

  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Ticket started', {
      ticket: serializeTicket(ticket, repo),
    }),
  );
});

/** EP-27 */
export const abandonTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const { ticketId } = req.params as { ticketId: string };
  const result = await ticketService.abandonTicket(user.id, ticketId);
  const repo = await githubService.getStarterRepoSummary(user.id);

  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Ticket abandoned', {
      abandonedTicketId: result.abandonedTicketId,
      newTicket: result.newTicket ? serializeTicket(result.newTicket, repo) : null,
    }),
  );
});
