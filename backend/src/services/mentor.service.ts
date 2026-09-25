import type { MentorMessage } from '@prisma/client';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

/**
 * Mentor domain service (BE-076 / doc 8 §8.8).
 * HTTP layer depends on these exports; full Gemini + persistence logic lands with M.
 * Controllers mock this module in unit tests.
 */
export const sendMentorMessage = async (
  userId: string,
  ticketId: string,
  content: string,
): Promise<{ userMessage: MentorMessage; mentorMessage: MentorMessage }> => {
  void userId;
  void ticketId;
  void content;
  throw new ApiError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    'Mentor service is not implemented yet',
  );
};

/** EP-29 history — oldest first; any owned ticket status (doc 8 §8.16). */
export const getMentorMessages = async (
  userId: string,
  ticketId: string,
): Promise<MentorMessage[]> => {
  void userId;
  void ticketId;
  throw new ApiError(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    'Mentor service is not implemented yet',
  );
};
