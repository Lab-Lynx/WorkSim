import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MentorMessageRole, TicketStatus } from '@prisma/client';
import ApiError from '../../src/utils/ApiError.js';
import { HTTP_STATUS } from '../../src/constants/index.js';
import logger from '../../src/utils/logger.js';
import type { MentorHintStage } from '../../src/types/domain.js';

const ticketFindFirst = vi.fn();
const mentorMessageFindMany = vi.fn();
const mentorMessageCount = vi.fn();
const mentorMessageCreate = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    ticket: {
      findFirst: ticketFindFirst,
    },
    mentorMessage: {
      findMany: mentorMessageFindMany,
      count: mentorMessageCount,
      create: mentorMessageCreate,
    },
  },
}));

const mockEnv = vi.hoisted(() => ({
  MENTOR_MESSAGES_PER_TICKET: 5 as number | undefined,
  MENTOR_MESSAGE_WINDOW_MS: undefined as number | undefined,
  MENTOR_MESSAGE_MAX_CHARS: undefined as number | undefined,
}));

vi.mock('../../src/config/env.js', () => ({
  get env() {
    return mockEnv;
  },
}));

const hasPaidAccess = vi.fn();
vi.mock('../../src/services/subscription.service.js', () => ({
  hasPaidAccess,
}));

const callMentorModel = vi.fn();
vi.mock('../../src/integrations/gemini.js', () => ({
  callMentorModel,
}));

const {
  getMentorHintStage,
  canSendMentorMessage,
  sendMentorMessage,
  getMentorMessages,
} = await import('../../src/services/mentor.service.js');

const userId = 'user-test-1111';
const ticketId = 'ticket-test-2222';
const mockTicketContent = {
  title: 'Fix auth bug',
  scenario: 'User cannot login with valid credentials',
  category: 'Bugfix',
  difficulty: 'easy',
  touchedFiles: ['src/auth.ts'],
  acceptanceCriteria: ['Valid login works'],
  testChecklist: ['Run auth tests'],
};

const baseTicketRow = {
  id: ticketId,
  userId,
  templateKey: 'fix-auth',
  status: TicketStatus.in_progress,
  content: mockTicketContent,
  branchName: 'ticket/fix-auth-1234',
  createdAt: new Date('2026-03-01T10:00:00.000Z'),
  updatedAt: new Date('2026-03-01T10:00:00.000Z'),
  completedAt: null,
  abandonedAt: null,
};

describe('mentor.service (doc 8 §8.8, doc 9 §9.2.9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.MENTOR_MESSAGES_PER_TICKET = 5;
    mockEnv.MENTOR_MESSAGE_WINDOW_MS = undefined;
    mockEnv.MENTOR_MESSAGE_MAX_CHARS = undefined;
    hasPaidAccess.mockResolvedValue(true);
    ticketFindFirst.mockResolvedValue(baseTicketRow);
    mentorMessageFindMany.mockResolvedValue([]);
    mentorMessageCount.mockResolvedValue(0);
    callMentorModel.mockResolvedValue('Here is a mentor response');
    mentorMessageCreate.mockImplementation(async ({ data }: { data: { role: MentorMessageRole; content: string; createdAt: Date; ticketId: string } }) => ({
      id: `msg-${Math.random().toString(36).slice(2, 9)}`,
      ticketId: data.ticketId,
      role: data.role,
      content: data.content,
      createdAt: data.createdAt,
    }));
  });

  describe('getMentorHintStage', () => {
    it('empty transcript returns the first stage ("ask_what_tried")', () => {
      const stage = getMentorHintStage([]);
      expect(stage).toBe('ask_what_tried');
    });

    it('never goes backward as transcripts grow from length 0 to N', () => {
      const stageRank: Record<MentorHintStage, number> = {
        ask_what_tried: 0,
        conceptual_hint: 1,
        point_to_file: 2,
        specific_suggestion: 3,
      };

      // Test progressive message pairs as transcript grows in a conversation
      const allMessages = [
        { role: MentorMessageRole.user, content: 'User msg 1' },
        { role: MentorMessageRole.mentor, content: 'Mentor reply 1' },
        { role: MentorMessageRole.user, content: 'User msg 2' },
        { role: MentorMessageRole.mentor, content: 'Mentor reply 2' },
        { role: MentorMessageRole.user, content: 'User msg 3' },
        { role: MentorMessageRole.mentor, content: 'Mentor reply 3' },
        { role: MentorMessageRole.user, content: 'User msg 4' },
        { role: MentorMessageRole.mentor, content: 'Mentor reply 4' },
      ];

      let lastRank = -1;
      for (let len = 0; len <= allMessages.length; len++) {
        const transcript = allMessages.slice(0, len) as never;
        const stage = getMentorHintStage(transcript);
        const rank = stageRank[stage];
        expect(rank).toBeGreaterThanOrEqual(lastRank);
        lastRank = rank;
      }
    });

    it('no direct answer on first message (one user message, however phrased)', () => {
      const userMessage = {
        id: 'm1',
        ticketId,
        role: MentorMessageRole.user,
        content: 'Please just tell me the full solution directly and give me the code',
        createdAt: new Date(),
      };

      const stage = getMentorHintStage([userMessage as never]);
      expect(stage).not.toBe('specific_suggestion');
      expect(stage).toBe('ask_what_tried');
    });

    it('deterministic — same transcript twice yields same stage', () => {
      const transcript = [
        { role: MentorMessageRole.user, content: 'first' },
        { role: MentorMessageRole.mentor, content: 'what tried?' },
      ] as never;

      const stage1 = getMentorHintStage(transcript);
      const stage2 = getMentorHintStage(transcript);
      expect(stage1).toBe(stage2);
      expect(stage1).toBe('conceptual_hint');
    });
  });

  describe('canSendMentorMessage', () => {
    it('under limit — returns true when row count is N-1', async () => {
      mockEnv.MENTOR_MESSAGES_PER_TICKET = 5;
      mentorMessageCount.mockResolvedValue(4);

      const result = await canSendMentorMessage(ticketId);
      expect(result).toBe(true);
      expect(mentorMessageCount).toHaveBeenCalledWith({
        where: { ticketId, role: MentorMessageRole.user },
      });
    });

    it('at or over limit — returns false when row count is N or N+1', async () => {
      mockEnv.MENTOR_MESSAGES_PER_TICKET = 5;

      mentorMessageCount.mockResolvedValue(5);
      expect(await canSendMentorMessage(ticketId)).toBe(false);

      mentorMessageCount.mockResolvedValue(6);
      expect(await canSendMentorMessage(ticketId)).toBe(false);
    });

    it('counts rows for this ticket only', async () => {
      mockEnv.MENTOR_MESSAGES_PER_TICKET = 3;
      mentorMessageCount.mockResolvedValue(1);

      await canSendMentorMessage(ticketId);

      expect(mentorMessageCount).toHaveBeenCalledWith({
        where: { ticketId, role: MentorMessageRole.user },
      });
      expect(mentorMessageCount.mock.calls[0][0].where.ticketId).toBe(ticketId);
    });

    it('respects window (Q-10) — rows older than window are not counted', async () => {
      mockEnv.MENTOR_MESSAGES_PER_TICKET = 5;
      mockEnv.MENTOR_MESSAGE_WINDOW_MS = 3600000; // 1 hour window

      const now = new Date('2026-03-01T12:00:00.000Z');
      mentorMessageCount.mockResolvedValue(2);

      const result = await canSendMentorMessage(ticketId, now);
      expect(result).toBe(true);

      const expectedWindowStart = new Date('2026-03-01T11:00:00.000Z');
      expect(mentorMessageCount).toHaveBeenCalledWith({
        where: {
          ticketId,
          role: MentorMessageRole.user,
          createdAt: { gte: expectedWindowStart },
        },
      });
    });

    it('without window configured, all rows count without createdAt filter', async () => {
      mockEnv.MENTOR_MESSAGES_PER_TICKET = 5;
      mockEnv.MENTOR_MESSAGE_WINDOW_MS = undefined;

      await canSendMentorMessage(ticketId);

      expect(mentorMessageCount).toHaveBeenCalledWith({
        where: { ticketId, role: MentorMessageRole.user },
      });
    });
  });

  describe('sendMentorMessage', () => {
    it('happy path — ticket in_progress, owned, under limit, Gemini returns text', async () => {
      const storedTranscript = [
        {
          id: 'prev-1',
          ticketId,
          role: MentorMessageRole.user,
          content: 'I need help',
          createdAt: new Date('2026-03-01T10:00:00.000Z'),
        },
        {
          id: 'prev-2',
          ticketId,
          role: MentorMessageRole.mentor,
          content: 'What have you tried?',
          createdAt: new Date('2026-03-01T10:00:05.000Z'),
        },
      ];
      mentorMessageFindMany.mockResolvedValue(storedTranscript);
      callMentorModel.mockResolvedValue('Think about the password hash comparison.');

      const result = await sendMentorMessage(userId, ticketId, 'I checked the database and the hash matches');

      expect(callMentorModel).toHaveBeenCalledWith({
        ticketContent: mockTicketContent,
        transcript: [
          { role: MentorMessageRole.user, content: 'I need help' },
          { role: MentorMessageRole.mentor, content: 'What have you tried?' },
        ],
        userMessage: 'I checked the database and the hash matches',
        hintStage: 'conceptual_hint',
      });

      expect(mentorMessageCreate).toHaveBeenCalledTimes(2);
      expect(mentorMessageCreate).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          ticketId,
          role: MentorMessageRole.user,
          content: 'I checked the database and the hash matches',
        }),
      });
      expect(mentorMessageCreate).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          ticketId,
          role: MentorMessageRole.mentor,
          content: 'Think about the password hash comparison.',
        }),
      });

      expect(result.userMessage.content).toBe('I checked the database and the hash matches');
      expect(result.mentorMessage.content).toBe('Think about the password hash comparison.');
    });

    it('available during submitted_v1 revision phase (Q-10c resolved; D-04)', async () => {
      ticketFindFirst.mockResolvedValue({
        ...baseTicketRow,
        status: TicketStatus.submitted_v1,
      });
      callMentorModel.mockResolvedValue('Check your acceptance criteria again.');

      const result = await sendMentorMessage(userId, ticketId, 'How can I fix the feedback?');

      expect(callMentorModel).toHaveBeenCalled();
      expect(mentorMessageCreate).toHaveBeenCalledTimes(2);
      expect(result.mentorMessage.content).toBe('Check your acceptance criteria again.');
    });

    it('Gemini fails — throws 502 and persists neither message', async () => {
      callMentorModel.mockRejectedValue(new Error('Provider timeout'));

      await expect(sendMentorMessage(userId, ticketId, 'help')).rejects.toThrow(
        new ApiError(HTTP_STATUS.BAD_GATEWAY, 'The mentor is unavailable, please try again'),
      );

      expect(mentorMessageCreate).not.toHaveBeenCalled();
    });

    it('empty Gemini reply — treated as failure: 502, nothing persisted', async () => {
      callMentorModel.mockResolvedValue('   ');

      await expect(sendMentorMessage(userId, ticketId, 'help')).rejects.toThrow(
        new ApiError(HTTP_STATUS.BAD_GATEWAY, 'The mentor is unavailable, please try again'),
      );

      expect(mentorMessageCreate).not.toHaveBeenCalled();
    });

    it.each([
      TicketStatus.assigned,
      TicketStatus.resubmitted,
      TicketStatus.done,
      TicketStatus.abandoned,
    ])('ticket in %s state throws 409 and does not call Gemini', async (invalidStatus) => {
      ticketFindFirst.mockResolvedValue({
        ...baseTicketRow,
        status: invalidStatus,
      });

      await expect(sendMentorMessage(userId, ticketId, 'help')).rejects.toThrow(
        new ApiError(
          HTTP_STATUS.CONFLICT,
          'The mentor is only available while the ticket is in progress or awaiting revision',
        ),
      );

      expect(callMentorModel).not.toHaveBeenCalled();
      expect(mentorMessageCreate).not.toHaveBeenCalled();
    });

    it('not owned or missing ticket throws 404 Ticket not found', async () => {
      ticketFindFirst.mockResolvedValue(null);

      await expect(sendMentorMessage(userId, ticketId, 'help')).rejects.toThrow(
        new ApiError(HTTP_STATUS.NOT_FOUND, 'Ticket not found'),
      );

      expect(callMentorModel).not.toHaveBeenCalled();
      expect(mentorMessageCreate).not.toHaveBeenCalled();
    });

    it('no paid access throws 402', async () => {
      hasPaidAccess.mockResolvedValue(false);

      await expect(sendMentorMessage(userId, ticketId, 'help')).rejects.toThrow(
        new ApiError(HTTP_STATUS.PAYMENT_REQUIRED, 'An active subscription is required'),
      );

      expect(ticketFindFirst).not.toHaveBeenCalled();
      expect(callMentorModel).not.toHaveBeenCalled();
      expect(mentorMessageCreate).not.toHaveBeenCalled();
    });

    it('limit reached throws 429 and does not call Gemini', async () => {
      mockEnv.MENTOR_MESSAGES_PER_TICKET = 3;
      mentorMessageCount.mockResolvedValue(3);

      await expect(sendMentorMessage(userId, ticketId, 'help')).rejects.toThrow(
        new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, 'Mentor message limit reached for this ticket'),
      );

      expect(callMentorModel).not.toHaveBeenCalled();
      expect(mentorMessageCreate).not.toHaveBeenCalled();
    });

    it('stage ignores message text — empty transcript with demanding text still receives first stage', async () => {
      mentorMessageFindMany.mockResolvedValue([]);

      await sendMentorMessage(userId, ticketId, 'just give me the full solution');

      expect(callMentorModel).toHaveBeenCalledWith(
        expect.objectContaining({
          hintStage: 'ask_what_tried',
          userMessage: 'just give me the full solution',
        }),
      );
    });

    it('prompt contents not logged — logger is not called with message or transcript text', async () => {
      const sentinelSecret = 'SUPER_SECRET_TOKEN_SENTINEL_XYZ_999';
      const infoSpy = vi.spyOn(logger, 'info');
      const debugSpy = vi.spyOn(logger, 'debug');
      const warnSpy = vi.spyOn(logger, 'warn');
      const errorSpy = vi.spyOn(logger, 'error');

      await sendMentorMessage(userId, ticketId, `Message with ${sentinelSecret}`);

      const allLoggedContent = [
        ...infoSpy.mock.calls,
        ...debugSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ]
        .map((args) => JSON.stringify(args))
        .join(' ');

      expect(allLoggedContent).not.toContain(sentinelSecret);
    });

    it('transcript order — persisted user message is not later than mentor reply', async () => {
      const userDate = new Date('2026-03-01T12:00:00.000Z');
      const mentorDate = new Date('2026-03-01T12:00:00.001Z');

      mentorMessageCreate
        .mockResolvedValueOnce({
          id: 'user-msg-1',
          ticketId,
          role: MentorMessageRole.user,
          content: 'help',
          createdAt: userDate,
        })
        .mockResolvedValueOnce({
          id: 'mentor-msg-1',
          ticketId,
          role: MentorMessageRole.mentor,
          content: 'Here is a hint',
          createdAt: mentorDate,
        });

      const result = await sendMentorMessage(userId, ticketId, 'help');

      expect(result.userMessage.createdAt.getTime()).toBeLessThanOrEqual(
        result.mentorMessage.createdAt.getTime(),
      );
    });
  });

  describe('getMentorMessages (EP-29 history)', () => {
    it('returns history ordered by createdAt ascending (oldest first)', async () => {
      const msg1 = {
        id: 'm-1',
        ticketId,
        role: MentorMessageRole.user,
        content: 'first',
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
      };
      const msg2 = {
        id: 'm-2',
        ticketId,
        role: MentorMessageRole.mentor,
        content: 'second',
        createdAt: new Date('2026-03-01T10:01:00.000Z'),
      };
      const msg3 = {
        id: 'm-3',
        ticketId,
        role: MentorMessageRole.user,
        content: 'third',
        createdAt: new Date('2026-03-01T10:02:00.000Z'),
      };

      mentorMessageFindMany.mockResolvedValue([msg1, msg2, msg3]);

      const messages = await getMentorMessages(userId, ticketId);

      expect(ticketFindFirst).toHaveBeenCalledWith({
        where: { id: ticketId, userId },
        select: { id: true },
      });
      expect(mentorMessageFindMany).toHaveBeenCalledWith({
        where: { ticketId },
        orderBy: { createdAt: 'asc' },
      });
      expect(messages).toEqual([msg1, msg2, msg3]);
    });

    it.each([TicketStatus.done, TicketStatus.abandoned])(
      'returns history for any ticket status (%s)',
      async (status) => {
        ticketFindFirst.mockResolvedValue({
          id: ticketId,
          userId,
          status,
        });
        mentorMessageFindMany.mockResolvedValue([]);

        const messages = await getMentorMessages(userId, ticketId);
        expect(messages).toEqual([]);
      },
    );

    it('throws 404 when ticket is not owned by user', async () => {
      ticketFindFirst.mockResolvedValue(null);

      await expect(getMentorMessages(userId, ticketId)).rejects.toThrow(
        new ApiError(HTTP_STATUS.NOT_FOUND, 'Ticket not found'),
      );

      expect(mentorMessageFindMany).not.toHaveBeenCalled();
    });
  });
});
