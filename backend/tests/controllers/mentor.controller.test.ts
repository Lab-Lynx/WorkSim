import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MentorMessageRole } from '@prisma/client';
import { HTTP_STATUS } from '../../src/constants/index.js';
import ApiError from '../../src/utils/ApiError.js';

const sendMentorMessage = vi.fn();
const getMentorMessages = vi.fn();

vi.mock('../../src/services/mentor.service.js', () => ({
  sendMentorMessage,
  getMentorMessages,
}));

const {
  sendMessage,
  getMessages,
} = await import('../../src/controllers/mentor.controller.js');

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

const ticketId = '11111111-1111-4111-8111-111111111111';
const createdAt = new Date('2026-03-01T12:00:00.000Z');

const userMessageRow = {
  id: 'um-1',
  ticketId,
  role: MentorMessageRole.user,
  content: 'help',
  createdAt,
};

const mentorMessageRow = {
  id: 'mm-1',
  ticketId,
  role: MentorMessageRole.mentor,
  content: 'What have you tried so far?',
  createdAt: new Date('2026-03-01T12:00:01.000Z'),
};

describe('mentor.controller (EP-28, EP-29)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sendMessage returns 201 Mentor replied with both serialized messages', async () => {
    sendMentorMessage.mockResolvedValue({
      userMessage: userMessageRow,
      mentorMessage: mentorMessageRow,
    });

    const req = {
      user: { id: 'user-1', role: 'user' },
      params: { ticketId },
      body: { content: 'help' },
    };
    const res = mockRes();
    const next = vi.fn();

    await sendMessage(req as never, res as never, next);

    expect(sendMentorMessage).toHaveBeenCalledWith('user-1', ticketId, 'help');
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Mentor replied');
    expect(body.data.userMessage).toEqual({
      id: 'um-1',
      role: 'user',
      content: 'help',
      createdAt: createdAt.toISOString(),
    });
    expect(body.data.mentorMessage).toEqual({
      id: 'mm-1',
      role: 'mentor',
      content: 'What have you tried so far?',
      createdAt: mentorMessageRow.createdAt.toISOString(),
    });
    expect(body.data.userMessage).not.toHaveProperty('ticketId');
    expect(next).not.toHaveBeenCalled();
  });

  it('sendMessage ignores client hintLevel/stage and only passes content', async () => {
    sendMentorMessage.mockResolvedValue({
      userMessage: userMessageRow,
      mentorMessage: mentorMessageRow,
    });

    const req = {
      user: { id: 'user-1', role: 'user' },
      params: { ticketId },
      body: { content: 'help', hintLevel: 99, stage: 'specific_suggestion' },
    };
    const res = mockRes();
    const next = vi.fn();

    await sendMessage(req as never, res as never, next);

    expect(sendMentorMessage).toHaveBeenCalledWith('user-1', ticketId, 'help');
    expect(sendMentorMessage.mock.calls[0]).toHaveLength(3);
  });

  it.each([
    [HTTP_STATUS.CONFLICT, 'The mentor is only available while the ticket is in progress or awaiting revision'],
    [HTTP_STATUS.TOO_MANY_REQUESTS, 'Mentor message limit reached for this ticket'],
    [HTTP_STATUS.BAD_GATEWAY, 'The mentor is unavailable, please try again'],
  ] as const)(
    'sendMessage forwards %s with the Doc 5 message and no provider text',
    async (status, message) => {
      const err = new ApiError(status, message);
      sendMentorMessage.mockRejectedValue(err);

      const req = {
        user: { id: 'user-1', role: 'user' },
        params: { ticketId },
        body: { content: 'help' },
      };
      const res = mockRes();
      const next = vi.fn();

      await sendMessage(req as never, res as never, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(next.mock.calls[0][0].message).toBe(message);
      expect(String(next.mock.calls[0][0].message)).not.toMatch(/gemini|api key|stack/i);
      expect(res.status).not.toHaveBeenCalled();
    },
  );

  it('getMessages returns 200 Mentor history in service order', async () => {
    getMentorMessages.mockResolvedValue([userMessageRow, mentorMessageRow]);

    const req = {
      user: { id: 'user-1', role: 'user' },
      params: { ticketId },
    };
    const res = mockRes();
    const next = vi.fn();

    await getMessages(req as never, res as never, next);

    expect(getMentorMessages).toHaveBeenCalledWith('user-1', ticketId);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Mentor history');
    expect(body.data.messages).toHaveLength(2);
    expect(body.data.messages[0].id).toBe('um-1');
    expect(body.data.messages[1].id).toBe('mm-1');
    expect(Object.keys(body.data.messages[0]).sort()).toEqual([
      'content',
      'createdAt',
      'id',
      'role',
    ]);
    expect(next).not.toHaveBeenCalled();
  });

  it('getMessages forwards 404 Ticket not found', async () => {
    const err = new ApiError(HTTP_STATUS.NOT_FOUND, 'Ticket not found');
    getMentorMessages.mockRejectedValue(err);

    const req = {
      user: { id: 'user-1', role: 'user' },
      params: { ticketId },
    };
    const res = mockRes();
    const next = vi.fn();

    await getMessages(req as never, res as never, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
