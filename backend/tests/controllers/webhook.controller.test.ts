import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';

const verifyChapaSignature = vi.fn();
const verifyGitHubSignature = vi.fn();
const processChapaWebhook = vi.fn();
const processGitHubWebhook = vi.fn();
const logWebhookProcessingFailure = vi.fn();

vi.mock('../../src/lib/webhooks/signature.js', () => ({
  verifyChapaSignature,
  verifyGitHubSignature,
}));
vi.mock('../../src/services/webhook.service.js', () => ({
  processChapaWebhook,
  processGitHubWebhook,
  logWebhookProcessingFailure,
}));

const { receiveChapaWebhook, receiveGitHubWebhook } = await import(
  '../../src/controllers/webhook.controller.js'
);

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('webhook.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyChapaSignature.mockReturnValue(true);
    verifyGitHubSignature.mockReturnValue(true);
    processChapaWebhook.mockResolvedValue(undefined);
    processGitHubWebhook.mockResolvedValue(undefined);
  });

  it('rejects an invalid Chapa signature without scheduling processing', () => {
    verifyChapaSignature.mockReturnValue(false);
    const res = response();

    receiveChapaWebhook(
      { rawBody: Buffer.from('{"tx_ref":"tx-1"}'), get: () => 'bad' } as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
    expect(processChapaWebhook).not.toHaveBeenCalled();
  });

  it('acknowledges a valid GitHub delivery before asynchronous processing', () => {
    const res = response();
    const body = Buffer.from(
      JSON.stringify({
        action: 'completed',
        workflow_run: { head_sha: 'sha-1' },
        repository: { full_name: 'Lab-Lynx/example' },
      }),
    );

    receiveGitHubWebhook(
      {
        rawBody: body,
        get: (header: string) =>
          ({
            'x-hub-signature-256': 'sha256=valid',
            'x-github-delivery': 'delivery-1',
            'x-github-event': 'workflow_run',
          })[header],
      } as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalled();
    expect(processGitHubWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'completed' }),
      'delivery-1',
      'workflow_run',
    );
  });
});
