import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import { serializeMentorMessage } from '../serializers/mentor-message.serializer.js';
import * as mentorService from '../services/mentor.service.js';

const requireUser = (req: AuthRequest) => {
  if (!req.user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  }
  return req.user;
};

/** EP-28 — send mentor message; paid access enforced at the route. */
export const sendMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const { ticketId } = req.params as { ticketId: string };
  const { content } = req.body as { content: string };

  const result = await mentorService.sendMentorMessage(user.id, ticketId, content);

  res.status(HTTP_STATUS.CREATED).json(
    new SuccessResponse(HTTP_STATUS.CREATED, 'Mentor replied', {
      userMessage: serializeMentorMessage(result.userMessage),
      mentorMessage: serializeMentorMessage(result.mentorMessage),
    }),
  );
});

/** EP-29 — mentor history, oldest first, any owned ticket status. */
export const getMessages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const { ticketId } = req.params as { ticketId: string };

  const messages = await mentorService.getMentorMessages(user.id, ticketId);

  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Mentor history', {
      messages: messages.map(serializeMentorMessage),
    }),
  );
});
