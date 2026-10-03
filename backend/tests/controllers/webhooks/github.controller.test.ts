import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/github-webhook.service', () => ({
  verifyGitHubWebhookSignature: vi.fn(),
  processWorkflowRunWebhook: vi.fn(),
}));

vi.mock('../../../src/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  verifyGitHubWebhookSignature,
  processWorkflowRunWebhook,
} from '../../../src/services/github-webhook.service';
import { logger } from '../../../src/lib/logger';
import { handleWorkflowRun } from '../../../src/controllers/webhooks/github.controller';

function mockReq(body: object, headers: Record<string, string> = {}) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    body: raw,
    header: (name: string) => headers[name.toLowerCase()] ?? headers[name],
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// Lets any fire-and-forget background work finish before we assert on it.
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleWorkflowRun', () => {
  it('responds 401 and never dispatches when the signature is invalid', async () => {
    (verifyGitHubWebhookSignature as any).mockReturnValue(false);
    const req = mockReq(
      { action: 'completed' },
      { 'x-hub-signature-256': 'sha256=bad', 'x-github-event': 'workflow_run' },
    );
    const res = mockRes();

    await handleWorkflowRun(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(processWorkflowRunWebhook).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('responds 401 when the signature header is missing entirely', async () => {
    (verifyGitHubWebhookSignature as any).mockReturnValue(false);
    const req = mockReq({ action: 'completed' }, { 'x-github-event': 'workflow_run' });
    const res = mockRes();

    await handleWorkflowRun(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('responds 200 and ignores a non-workflow_run event without dispatching', async () => {
    (verifyGitHubWebhookSignature as any).mockReturnValue(true);
    const req = mockReq(
      { zen: 'hello' },
      { 'x-hub-signature-256': 'sha256=good', 'x-github-event': 'ping' },
    );
    const res = mockRes();

    await handleWorkflowRun(req, res);
    await flush();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(processWorkflowRunWebhook).not.toHaveBeenCalled();
  });

  it('responds 200 and ignores a workflow_run event that is not "completed"', async () => {
    (verifyGitHubWebhookSignature as any).mockReturnValue(true);
    const req = mockReq(
      { action: 'requested' },
      { 'x-hub-signature-256': 'sha256=good', 'x-github-event': 'workflow_run' },
    );
    const res = mockRes();

    await handleWorkflowRun(req, res);
    await flush();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(processWorkflowRunWebhook).not.toHaveBeenCalled();
  });

  it('responds 200 immediately, then dispatches a completed workflow_run event', async () => {
    (verifyGitHubWebhookSignature as any).mockReturnValue(true);
    (processWorkflowRunWebhook as any).mockResolvedValue(undefined);

    const payload = {
      action: 'completed',
      repository: { full_name: 'octocat/work-simulator' },
      workflow_run: { head_sha: 'sha-1', conclusion: 'success', html_url: 'https://x' },
    };
    const req = mockReq(payload, {
      'x-hub-signature-256': 'sha256=good',
      'x-github-event': 'workflow_run',
    });
    const res = mockRes();

    await handleWorkflowRun(req, res);

    // The response is already sent BEFORE processing has any chance to finish.
    expect(res.status).toHaveBeenCalledWith(200);

    await flush();
    expect(processWorkflowRunWebhook).toHaveBeenCalledWith(payload);
  });

  it('logs processing-failed if dispatch throws, without touching the already-sent response', async () => {
    (verifyGitHubWebhookSignature as any).mockReturnValue(true);
    (processWorkflowRunWebhook as any).mockRejectedValue(new Error('db exploded'));

    const payload = {
      action: 'completed',
      repository: { full_name: 'octocat/work-simulator' },
      workflow_run: { head_sha: 'sha-2', conclusion: 'failure', html_url: 'https://x' },
    };
    const req = mockReq(payload, {
      'x-hub-signature-256': 'sha256=good',
      'x-github-event': 'workflow_run',
    });
    const res = mockRes();

    await handleWorkflowRun(req, res);
    await flush();

    expect(res.status).toHaveBeenCalledTimes(1); // only the original 200 — ever
    expect(logger.error).toHaveBeenCalled();
  });

  it('logs received and verified distinctly, without logging a rejection', async () => {
    (verifyGitHubWebhookSignature as any).mockReturnValue(true);
    (processWorkflowRunWebhook as any).mockResolvedValue(undefined);

    const req = mockReq(
      {
        action: 'completed',
        repository: { full_name: 'x' },
        workflow_run: { head_sha: 's', conclusion: 'success', html_url: 'u' },
      },
      { 'x-hub-signature-256': 'sha256=good', 'x-github-event': 'workflow_run' },
    );
    const res = mockRes();

    await handleWorkflowRun(req, res);
    await flush();

    expect(logger.info).toHaveBeenCalled(); // received + verified
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
