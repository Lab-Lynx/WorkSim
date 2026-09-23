import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketStatus } from '@prisma/client';
import { HTTP_STATUS } from '../../src/constants/index.js';
import ApiError from '../../src/utils/ApiError.js';

const assignNextTicket = vi.fn();
const getCurrentTicket = vi.fn();
const getTicketById = vi.fn();
const startTicket = vi.fn();
const abandonTicket = vi.fn();

vi.mock('../../src/services/ticket.service.js', () => ({
  assignNextTicket,
  getCurrentTicket,
  getTicketById,
  startTicket,
  abandonTicket,
}));

const getStarterRepoSummary = vi.fn();
vi.mock('../../src/services/github.service.js', () => ({
  getStarterRepoSummary,
}));

const {
  assignTicket,
  currentTicket,
  getTicket,
  startTicket: startTicketCtrl,
  abandonTicket: abandonTicketCtrl,
} = await import('../../src/controllers/ticket.controller.js');

const content = {
  title: 'Add a button',
  scenario: 'Wire a button',
  category: 'frontend',
  difficulty: 'beginner',
  touchedFiles: ['src/App.tsx'],
  acceptanceCriteria: ['Button renders'],
  testChecklist: ['Unit test'],
};

const ticketRow = {
  id: '11111111-1111-4111-8111-111111111111',
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

const repo = { fullName: 'ada/starter', defaultBranch: 'main' };

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

const ticketKeys = [
  'id',
  'status',
  'templateKey',
  'title',
  'scenario',
  'category',
  'difficulty',
  'touchedFiles',
  'acceptanceCriteria',
  'testChecklist',
  'branchName',
  'repo',
  'createdAt',
  'completedAt',
  'abandonedAt',
].sort();

describe('ticket.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStarterRepoSummary.mockResolvedValue(repo);
  });

  it('assignTicket returns 201 with flattened Doc 5 Ticket keys', async () => {
    assignNextTicket.mockResolvedValue(ticketRow);
    const req = { user: { id: 'user-1', role: 'user' } };
    const res = mockRes();
    const next = vi.fn();

    await assignTicket(req as never, res as never, next);

    expect(assignNextTicket).toHaveBeenCalledWith('user-1');
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Ticket assigned');
    expect(Object.keys(body.data.ticket).sort()).toEqual(ticketKeys);
    expect(body.data.ticket.title).toBe(content.title);
    expect(body.data.ticket).not.toHaveProperty('content');
    expect(next).not.toHaveBeenCalled();
  });

  it('currentTicket returns ticket then null', async () => {
    getCurrentTicket.mockResolvedValueOnce(ticketRow).mockResolvedValueOnce(null);
    const req = { user: { id: 'user-1', role: 'user' } };
    const res = mockRes();
    const next = vi.fn();

    await currentTicket(req as never, res as never, next);
    expect(res.json.mock.calls[0][0].message).toBe('Current ticket');
    expect(res.json.mock.calls[0][0].data.ticket.id).toBe(ticketRow.id);

    await currentTicket(req as never, res as never, next);
    expect(res.json.mock.calls[1][0].data.ticket).toBeNull();
  });

  it('getTicket forwards 404 from the service', async () => {
    getTicketById.mockRejectedValue(
      new ApiError(HTTP_STATUS.NOT_FOUND, 'Ticket not found'),
    );
    const req = {
      user: { id: 'user-1', role: 'user' },
      params: { ticketId: ticketRow.id },
    };
    const res = mockRes();
    const next = vi.fn();

    await getTicket(req as never, res as never, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Ticket not found',
      }),
    );
  });

  it('startTicket returns 200 Ticket started', async () => {
    startTicket.mockResolvedValue({
      ...ticketRow,
      status: TicketStatus.in_progress,
    });
    const req = {
      user: { id: 'user-1', role: 'user' },
      params: { ticketId: ticketRow.id },
    };
    const res = mockRes();
    const next = vi.fn();

    await startTicketCtrl(req as never, res as never, next);

    expect(startTicket).toHaveBeenCalledWith('user-1', ticketRow.id);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json.mock.calls[0][0].message).toBe('Ticket started');
  });

  it('abandonTicket returns abandonedTicketId and newTicket (including null)', async () => {
    abandonTicket
      .mockResolvedValueOnce({
        abandonedTicketId: ticketRow.id,
        newTicket: { ...ticketRow, id: '22222222-2222-4222-8222-222222222222' },
      })
      .mockResolvedValueOnce({ abandonedTicketId: ticketRow.id, newTicket: null });

    const req = {
      user: { id: 'user-1', role: 'user' },
      params: { ticketId: ticketRow.id },
    };
    const res = mockRes();
    const next = vi.fn();

    await abandonTicketCtrl(req as never, res as never, next);
    expect(res.json.mock.calls[0][0].message).toBe('Ticket abandoned');
    expect(res.json.mock.calls[0][0].data.newTicket.id).toBe(
      '22222222-2222-4222-8222-222222222222',
    );

    await abandonTicketCtrl(req as never, res as never, next);
    expect(res.json.mock.calls[1][0].data.newTicket).toBeNull();
  });
});
