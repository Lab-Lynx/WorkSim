import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, TicketStatus } from '@prisma/client';
import ApiError from '../../src/utils/ApiError.js';
import { HTTP_STATUS } from '../../src/constants/index.js';

const ticketFindFirst = vi.fn();
const ticketFindMany = vi.fn();
const ticketFindUnique = vi.fn();
const ticketFindUniqueOrThrow = vi.fn();
const ticketCreate = vi.fn();
const ticketUpdateMany = vi.fn();
const starterRepoFindUnique = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    ticket: {
      findFirst: ticketFindFirst,
      findMany: ticketFindMany,
      findUnique: ticketFindUnique,
      findUniqueOrThrow: ticketFindUniqueOrThrow,
      create: ticketCreate,
      updateMany: ticketUpdateMany,
    },
    starterRepo: {
      findUnique: starterRepoFindUnique,
    },
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: { BRANCH_NAME_PREFIX: 'ticket/' },
}));

const hasPaidAccess = vi.fn();
vi.mock('../../src/services/subscription.service.js', () => ({
  hasPaidAccess,
}));

const assertGitHubConnected = vi.fn();
const assertStarterRepo = vi.fn();
const createTicketBranch = vi.fn();
vi.mock('../../src/services/github.service.js', () => ({
  assertGitHubConnected,
  assertStarterRepo,
  createTicketBranch,
}));

const selectNextTicketTemplate = vi.fn();
const loadTicketTemplate = vi.fn();
const generateTicketContent = vi.fn();
vi.mock('../../src/services/ticket-generation.service.js', () => ({
  selectNextTicketTemplate,
  loadTicketTemplate,
  generateTicketContent,
}));

const {
  assignNextTicket,
  getCurrentTicket,
  getTicketById,
  startTicket,
  abandonTicket,
} = await import('../../src/services/ticket.service.js');

const content = {
  title: 'Add a button',
  scenario: 'Wire a button',
  category: 'frontend',
  difficulty: 'beginner',
  touchedFiles: ['src/App.tsx'],
  acceptanceCriteria: ['Button renders'],
  testChecklist: ['Unit test'],
};

const template = {
  key: 'react-add-button',
  category: 'frontend',
  difficulty: 'beginner',
  touchedFiles: ['src/App.tsx'],
  acceptanceCriteriaStructure: ['Add button'],
  testChecklistStructure: ['Test button'],
};

const repo = {
  id: 'repo-1',
  userId: 'user-1',
  starterTemplate: 'react',
  githubRepoId: '1',
  fullName: 'ada/starter',
  defaultBranch: 'main',
  createdAt: new Date(),
};

const baseTicket = {
  id: 'ticket-1',
  userId: 'user-1',
  templateKey: 'react-add-button',
  status: TicketStatus.assigned,
  content,
  branchName: 'ticket/react-add-button-abcd',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  completedAt: null,
  abandonedAt: null,
};

const callOrder: string[] = [];

function stubHappyGates() {
  hasPaidAccess.mockImplementation(async () => {
    callOrder.push('access');
    return true;
  });
  assertGitHubConnected.mockImplementation(async () => {
    callOrder.push('connection');
  });
  assertStarterRepo.mockImplementation(async () => {
    callOrder.push('repo');
    return repo;
  });
  ticketFindFirst.mockImplementation(async () => {
    callOrder.push('active-check');
    return null;
  });
  selectNextTicketTemplate.mockImplementation(async () => {
    callOrder.push('select');
    return { templateKey: template.key };
  });
  loadTicketTemplate.mockReturnValue(template);
  generateTicketContent.mockImplementation(async () => {
    callOrder.push('generate');
    return content;
  });
  createTicketBranch.mockImplementation(async () => {
    callOrder.push('branch');
  });
  ticketCreate.mockImplementation(async (args: { data: typeof baseTicket }) => {
    callOrder.push('create');
    return { ...baseTicket, ...args.data, id: 'ticket-1' };
  });
}

describe('ticket.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
  });

  describe('assignNextTicket', () => {
    it('happy path follows Doc 8 order and returns assigned ticket', async () => {
      stubHappyGates();

      const result = await assignNextTicket('user-1');

      expect(callOrder).toEqual([
        'access',
        'connection',
        'repo',
        'active-check',
        'select',
        'generate',
        'branch',
        'create',
      ]);
      expect(result.status).toBe(TicketStatus.assigned);
      expect(result.templateKey).toBe(template.key);
      expect(result.content).toEqual(content);
      expect(result.branchName).toMatch(/^ticket\/react-add-button-/);
      expect(createTicketBranch).toHaveBeenCalledWith(
        'user-1',
        result.branchName,
        'main',
      );
    });

    it('throws 402 when unpaid and skips Gemini/GitHub branch', async () => {
      hasPaidAccess.mockResolvedValue(false);

      await expect(assignNextTicket('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.PAYMENT_REQUIRED,
        message: 'An active subscription is required',
      });
      expect(assertGitHubConnected).not.toHaveBeenCalled();
      expect(generateTicketContent).not.toHaveBeenCalled();
      expect(createTicketBranch).not.toHaveBeenCalled();
    });

    it('throws 403 when GitHub is not connected', async () => {
      hasPaidAccess.mockResolvedValue(true);
      assertGitHubConnected.mockRejectedValue(
        new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'GitHub is not connected. Connect GitHub to continue',
        ),
      );

      await expect(assignNextTicket('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
      });
      expect(generateTicketContent).not.toHaveBeenCalled();
    });

    it('throws 409 when starter repo is missing', async () => {
      hasPaidAccess.mockResolvedValue(true);
      assertGitHubConnected.mockResolvedValue(undefined);
      assertStarterRepo.mockRejectedValue(
        new ApiError(
          HTTP_STATUS.CONFLICT,
          'Create your starter repository before requesting a ticket',
        ),
      );

      await expect(assignNextTicket('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'Create your starter repository before requesting a ticket',
      });
      expect(generateTicketContent).not.toHaveBeenCalled();
    });

    it.each([
      TicketStatus.assigned,
      TicketStatus.in_progress,
      TicketStatus.submitted_v1,
      TicketStatus.resubmitted,
    ])('throws 409 when an active ticket exists (%s)', async (status) => {
      hasPaidAccess.mockResolvedValue(true);
      assertGitHubConnected.mockResolvedValue(undefined);
      assertStarterRepo.mockResolvedValue(repo);
      ticketFindFirst.mockResolvedValue({ ...baseTicket, status });

      await expect(assignNextTicket('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'You already have an active ticket',
      });
      expect(generateTicketContent).not.toHaveBeenCalled();
    });

    it('assigns when only done and abandoned tickets exist', async () => {
      stubHappyGates();
      ticketFindFirst.mockResolvedValue(null);

      const result = await assignNextTicket('user-1');
      expect(result.status).toBe(TicketStatus.assigned);
    });

    it('throws 502 when generation fails and does not create branch or ticket', async () => {
      stubHappyGates();
      generateTicketContent.mockRejectedValue(new Error('gemini down'));

      await expect(assignNextTicket('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_GATEWAY,
        message: 'Could not generate a ticket, please try again',
      });
      expect(createTicketBranch).not.toHaveBeenCalled();
      expect(ticketCreate).not.toHaveBeenCalled();
    });

    it('throws 502 when generation returns invalid content (ApiError)', async () => {
      stubHappyGates();
      generateTicketContent.mockRejectedValue(
        new ApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'Could not generate a ticket, please try again',
        ),
      );

      await expect(assignNextTicket('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_GATEWAY,
      });
      expect(createTicketBranch).not.toHaveBeenCalled();
      expect(ticketCreate).not.toHaveBeenCalled();
    });

    it('throws 502 when branch creation fails', async () => {
      stubHappyGates();
      createTicketBranch.mockRejectedValue(
        new ApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'Could not create the ticket branch on GitHub, please try again',
        ),
      );

      await expect(assignNextTicket('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_GATEWAY,
        message: 'Could not create the ticket branch on GitHub, please try again',
      });
      expect(ticketCreate).not.toHaveBeenCalled();
    });

    it('propagates 403 when token is invalid at branch step', async () => {
      stubHappyGates();
      createTicketBranch.mockRejectedValue(
        new ApiError(
          HTTP_STATUS.FORBIDDEN,
          'GitHub is not connected. Connect GitHub to continue',
        ),
      );

      await expect(assignNextTicket('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
      });
      expect(ticketCreate).not.toHaveBeenCalled();
    });

    it('rejects when ticket insert fails after branch', async () => {
      stubHappyGates();
      ticketCreate.mockRejectedValue(new Error('db write failed'));

      await expect(assignNextTicket('user-1')).rejects.toThrow('db write failed');
    });

    it('maps DR-01 unique violation to 409', async () => {
      stubHappyGates();
      ticketCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(assignNextTicket('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'You already have an active ticket',
      });
    });
  });

  describe('getCurrentTicket', () => {
    it('returns null when there are no tickets', async () => {
      ticketFindMany.mockResolvedValue([]);
      await expect(getCurrentTicket('user-1')).resolves.toBeNull();
    });

    it('returns null when only done and abandoned exist', async () => {
      ticketFindMany.mockResolvedValue([]);
      await expect(getCurrentTicket('user-1')).resolves.toBeNull();
      expect(ticketFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            status: {
              in: [
                TicketStatus.assigned,
                TicketStatus.in_progress,
                TicketStatus.submitted_v1,
                TicketStatus.resubmitted,
              ],
            },
          },
        }),
      );
    });

    it.each([
      TicketStatus.assigned,
      TicketStatus.in_progress,
      TicketStatus.submitted_v1,
      TicketStatus.resubmitted,
    ])('returns the ticket for active status %s', async (status) => {
      ticketFindMany.mockResolvedValue([{ ...baseTicket, status }]);
      const result = await getCurrentTicket('user-1');
      expect(result?.status).toBe(status);
      expect(result?.content).toEqual(content);
    });

    it('throws on multiple active rows', async () => {
      ticketFindMany.mockResolvedValue([
        { ...baseTicket, id: 'a' },
        { ...baseTicket, id: 'b' },
      ]);

      await expect(getCurrentTicket('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: expect.stringContaining('multiple active tickets'),
      });
    });
  });

  describe('getTicketById', () => {
    it('returns owned ticket with submissions ordered by attempt and no diff', async () => {
      ticketFindFirst.mockResolvedValue({
        ...baseTicket,
        submissions: [
          {
            id: 's1',
            attempt: 1,
            status: 'completed',
            prNumber: 1,
            headSha: 'abc',
            ciPassed: true,
            ciRunUrl: null,
            failureReason: null,
            submittedAt: new Date(),
            evaluation: {
              feedback: 'ok',
              requirementsMetScore: null,
              correctnessTestsScore: null,
              codeQualityScore: null,
              problemSolvingScore: null,
              totalScore: null,
              createdAt: new Date(),
            },
          },
          {
            id: 's2',
            attempt: 2,
            status: 'completed',
            prNumber: 1,
            headSha: 'def',
            ciPassed: true,
            ciRunUrl: null,
            failureReason: null,
            submittedAt: new Date(),
            evaluation: null,
          },
        ],
      });
      starterRepoFindUnique.mockResolvedValue({
        fullName: 'ada/starter',
        defaultBranch: 'main',
      });

      const result = await getTicketById('user-1', 'ticket-1');

      expect(result.ticket.id).toBe('ticket-1');
      expect(result.submissions.map((s) => s.attempt)).toEqual([1, 2]);
      expect(result.submissions[0]).not.toHaveProperty('diff');
      expect(ticketFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-1', userId: 'user-1' },
        }),
      );
    });

    it('throws 404 for someone else\'s ticket', async () => {
      ticketFindFirst.mockResolvedValue(null);
      await expect(getTicketById('user-1', 'other')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Ticket not found',
      });
    });

    it('throws 404 for a non-existent id', async () => {
      ticketFindFirst.mockResolvedValue(null);
      await expect(getTicketById('user-1', 'missing')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Ticket not found',
      });
    });

    it.each([TicketStatus.done, TicketStatus.abandoned])(
      'returns %s tickets',
      async (status) => {
        ticketFindFirst.mockResolvedValue({
          ...baseTicket,
          status,
          submissions: [],
        });
        starterRepoFindUnique.mockResolvedValue(null);

        const result = await getTicketById('user-1', 'ticket-1');
        expect(result.ticket.status).toBe(status);
      },
    );
  });

  describe('startTicket', () => {
    it('moves assigned to in_progress', async () => {
      hasPaidAccess.mockResolvedValue(true);
      ticketFindFirst.mockResolvedValue(baseTicket);
      ticketUpdateMany.mockResolvedValue({ count: 1 });
      ticketFindUniqueOrThrow.mockResolvedValue({
        ...baseTicket,
        status: TicketStatus.in_progress,
      });

      const result = await startTicket('user-1', 'ticket-1');
      expect(result.status).toBe(TicketStatus.in_progress);
      expect(ticketUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'ticket-1',
          userId: 'user-1',
          status: TicketStatus.assigned,
        },
        data: { status: TicketStatus.in_progress },
      });
    });

    it('throws 404 when missing or not owned', async () => {
      hasPaidAccess.mockResolvedValue(true);
      ticketFindFirst.mockResolvedValue(null);

      await expect(startTicket('user-1', 'missing')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Ticket not found',
      });
    });

    it.each([
      TicketStatus.in_progress,
      TicketStatus.submitted_v1,
      TicketStatus.resubmitted,
      TicketStatus.done,
      TicketStatus.abandoned,
    ])('throws 409 when already started (%s)', async (status) => {
      hasPaidAccess.mockResolvedValue(true);
      ticketFindFirst.mockResolvedValue({ ...baseTicket, status });
      ticketUpdateMany.mockResolvedValue({ count: 0 });

      await expect(startTicket('user-1', 'ticket-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'This ticket has already been started',
      });
    });

    it('throws 402 without paid access', async () => {
      hasPaidAccess.mockResolvedValue(false);
      await expect(startTicket('user-1', 'ticket-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.PAYMENT_REQUIRED,
      });
      expect(ticketUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('abandonTicket', () => {
    it.each([TicketStatus.assigned, TicketStatus.in_progress])(
      'abandons from %s and returns a replacement',
      async (status) => {
        hasPaidAccess.mockResolvedValue(true);
        assertGitHubConnected.mockResolvedValue(undefined);
        assertStarterRepo.mockResolvedValue(repo);
        ticketFindFirst
          .mockResolvedValueOnce({ ...baseTicket, status })
          .mockResolvedValueOnce(null);
        ticketUpdateMany.mockResolvedValue({ count: 1 });
        selectNextTicketTemplate.mockResolvedValue({ templateKey: template.key });
        loadTicketTemplate.mockReturnValue(template);
        generateTicketContent.mockResolvedValue(content);
        createTicketBranch.mockResolvedValue(undefined);
        ticketCreate.mockResolvedValue({
          ...baseTicket,
          id: 'ticket-2',
          branchName: 'ticket/react-add-button-new',
        });

        const result = await abandonTicket('user-1', 'ticket-1');

        expect(ticketUpdateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: TicketStatus.abandoned,
              abandonedAt: expect.any(Date),
            }),
          }),
        );
        expect(result.abandonedTicketId).toBe('ticket-1');
        expect(result.newTicket?.id).toBe('ticket-2');
      },
    );

    it.each([
      TicketStatus.submitted_v1,
      TicketStatus.resubmitted,
      TicketStatus.done,
    ])('throws 409 after submission (%s)', async (status) => {
      hasPaidAccess.mockResolvedValue(true);
      assertGitHubConnected.mockResolvedValue(undefined);
      assertStarterRepo.mockResolvedValue(repo);
      ticketFindFirst.mockResolvedValue({ ...baseTicket, status });

      await expect(abandonTicket('user-1', 'ticket-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'A ticket cannot be abandoned after it has been submitted',
      });
    });

    it('throws 404 when not owned', async () => {
      hasPaidAccess.mockResolvedValue(true);
      assertGitHubConnected.mockResolvedValue(undefined);
      assertStarterRepo.mockResolvedValue(repo);
      ticketFindFirst.mockResolvedValue(null);

      await expect(abandonTicket('user-1', 'x')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
      });
    });

    it('keeps abandon when replacement generation fails', async () => {
      hasPaidAccess.mockResolvedValue(true);
      assertGitHubConnected.mockResolvedValue(undefined);
      assertStarterRepo.mockResolvedValue(repo);
      ticketFindFirst
        .mockResolvedValueOnce(baseTicket)
        .mockResolvedValueOnce(null);
      ticketUpdateMany.mockResolvedValue({ count: 1 });
      selectNextTicketTemplate.mockResolvedValue({ templateKey: template.key });
      loadTicketTemplate.mockReturnValue(template);
      generateTicketContent.mockRejectedValue(
        new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not generate a ticket, please try again'),
      );

      const result = await abandonTicket('user-1', 'ticket-1');
      expect(result).toEqual({ abandonedTicketId: 'ticket-1', newTicket: null });
    });

    it('keeps abandon when replacement branch fails', async () => {
      hasPaidAccess.mockResolvedValue(true);
      assertGitHubConnected.mockResolvedValue(undefined);
      assertStarterRepo.mockResolvedValue(repo);
      ticketFindFirst
        .mockResolvedValueOnce(baseTicket)
        .mockResolvedValueOnce(null);
      ticketUpdateMany.mockResolvedValue({ count: 1 });
      selectNextTicketTemplate.mockResolvedValue({ templateKey: template.key });
      loadTicketTemplate.mockReturnValue(template);
      generateTicketContent.mockResolvedValue(content);
      createTicketBranch.mockRejectedValue(
        new ApiError(
          HTTP_STATUS.BAD_GATEWAY,
          'Could not create the ticket branch on GitHub, please try again',
        ),
      );

      const result = await abandonTicket('user-1', 'ticket-1');
      expect(result.newTicket).toBeNull();
    });

    it('does not delete tickets on abandon', async () => {
      hasPaidAccess.mockResolvedValue(true);
      assertGitHubConnected.mockResolvedValue(undefined);
      assertStarterRepo.mockResolvedValue(repo);
      ticketFindFirst
        .mockResolvedValueOnce(baseTicket)
        .mockResolvedValueOnce(null);
      ticketUpdateMany.mockResolvedValue({ count: 1 });
      selectNextTicketTemplate.mockResolvedValue({ templateKey: template.key });
      loadTicketTemplate.mockReturnValue(template);
      generateTicketContent.mockResolvedValue(content);
      createTicketBranch.mockResolvedValue(undefined);
      ticketCreate.mockResolvedValue({ ...baseTicket, id: 'ticket-2' });

      await abandonTicket('user-1', 'ticket-1');

      expect(ticketUpdateMany).toHaveBeenCalled();
      expect(ticketCreate).toHaveBeenCalled();
    });

    it('throws 409 on abandon vs submit race', async () => {
      hasPaidAccess.mockResolvedValue(true);
      assertGitHubConnected.mockResolvedValue(undefined);
      assertStarterRepo.mockResolvedValue(repo);
      ticketFindFirst.mockResolvedValue(baseTicket);
      ticketUpdateMany.mockResolvedValue({ count: 0 });

      await expect(abandonTicket('user-1', 'ticket-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'A ticket cannot be abandoned after it has been submitted',
      });
    });

    it('throws 402 without paid access', async () => {
      hasPaidAccess.mockResolvedValue(false);
      await expect(abandonTicket('user-1', 'ticket-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.PAYMENT_REQUIRED,
      });
    });
  });
});
