import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmissionStatus } from '@prisma/client';
import { HTTP_STATUS } from '../../src/constants/index.js';
import ApiError from '../../src/utils/ApiError.js';

const submitWork = vi.fn();
const getSubmission = vi.fn();
const retrySubmission = vi.fn();

vi.mock('../../src/services/submission.service.js', () => ({
  submitWork,
  getSubmission,
  retrySubmission,
}));

const getStarterRepoSummary = vi.fn();
vi.mock('../../src/services/github.service.js', () => ({
  getStarterRepoSummary,
}));

const {
  submit,
  getSubmission: getSubmissionCtrl,
  retry,
} = await import('../../src/controllers/submission.controller.js');

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

const ticketId = '11111111-1111-4111-8111-111111111111';
const submissionRow = {
  id: 'sub-1',
  ticketId,
  attempt: 1,
  status: SubmissionStatus.awaiting_ci,
  prNumber: 7,
  headSha: 'deadbeef',
  diff: 'diff',
  ciPassed: null,
  ciRunUrl: null,
  failureReason: null,
  submittedAt: new Date('2026-04-01T00:00:00.000Z'),
  updatedAt: new Date('2026-04-01T00:00:00.000Z'),
};

describe('submission.controller (EP-30–EP-32)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStarterRepoSummary.mockResolvedValue({
      fullName: 'ada/starter',
      defaultBranch: 'main',
    });
  });

  it('submit returns 202 Submission received without accepting attempt from body', async () => {
    submitWork.mockResolvedValue(submissionRow);

    const req = {
      user: { id: 'user-1', role: 'user' },
      params: { ticketId },
      body: { attempt: 2 },
    };
    const res = mockRes();
    const next = vi.fn();

    await submit(req as never, res as never, next);

    expect(submitWork).toHaveBeenCalledWith('user-1', ticketId);
    expect(submitWork.mock.calls[0]).toHaveLength(2);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.ACCEPTED);
    expect(res.json.mock.calls[0][0].message).toBe('Submission received');
    expect(res.json.mock.calls[0][0].data.submission).not.toHaveProperty('diff');
    expect(next).not.toHaveBeenCalled();
  });

  it('getSubmission passes attempt and includeDiff from validated params/query', async () => {
    getSubmission.mockResolvedValue({
      id: 'sub-1',
      attempt: 1,
      status: 'awaiting_ci',
      prNumber: 7,
      prUrl: 'https://github.com/ada/starter/pull/7',
      headSha: 'deadbeef',
      ciPassed: null,
      ciRunUrl: null,
      failureReason: null,
      submittedAt: '2026-04-01T00:00:00.000Z',
      evaluation: null,
    });

    const req = {
      user: { id: 'user-1', role: 'user' },
      params: { ticketId, attempt: '1' },
      validatedQuery: { includeDiff: true },
    };
    const res = mockRes();
    const next = vi.fn();

    await getSubmissionCtrl(req as never, res as never, next);

    expect(getSubmission).toHaveBeenCalledWith('user-1', ticketId, 1, true);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json.mock.calls[0][0].message).toBe('Submission');
  });

  it('getSubmission defaults includeDiff to false when query absent', async () => {
    getSubmission.mockResolvedValue({ id: 'sub-1' });

    await getSubmissionCtrl(
      {
        user: { id: 'user-1', role: 'user' },
        params: { ticketId, attempt: '2' },
      } as never,
      mockRes() as never,
      vi.fn(),
    );

    expect(getSubmission).toHaveBeenCalledWith('user-1', ticketId, 2, false);
  });

  it('retry returns 202 Retry started', async () => {
    retrySubmission.mockResolvedValue({
      ...submissionRow,
      status: SubmissionStatus.awaiting_ci,
    });

    const req = {
      user: { id: 'user-1', role: 'user' },
      params: { ticketId, attempt: '1' },
    };
    const res = mockRes();
    const next = vi.fn();

    await retry(req as never, res as never, next);

    expect(retrySubmission).toHaveBeenCalledWith('user-1', ticketId, 1);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.ACCEPTED);
    expect(res.json.mock.calls[0][0].message).toBe('Retry started');
  });

  it('forwards service errors to next', async () => {
    const err = new ApiError(HTTP_STATUS.CONFLICT, 'Only a failed submission can be retried');
    retrySubmission.mockRejectedValue(err);

    const next = vi.fn();
    await retry(
      {
        user: { id: 'user-1', role: 'user' },
        params: { ticketId, attempt: '1' },
      } as never,
      mockRes() as never,
      next,
    );

    expect(next).toHaveBeenCalledWith(err);
  });
});
