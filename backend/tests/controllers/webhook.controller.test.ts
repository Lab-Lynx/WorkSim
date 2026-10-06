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

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const chapaRequest = (body: string, signature = 'sig') =>
  ({ rawBody: Buffer.from(body), id: 'req-1', get: () => signature }) as never;

const githubRequest = (body: string, headers: Record<string, string | undefined> = {}) => {
  const all: Record<string, string | undefined> = {
    'x-hub-signature-256': 'sha256=valid',
    'x-github-delivery': 'delivery-1',
    'x-github-event': 'workflow_run',
    ...headers,
  };
  return { rawBody: Buffer.from(body), id: 'req-1', get: (name: string) => all[name] } as never;
};

describe('webhook.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyChapaSignature.mockReturnValue(true);
    verifyGitHubSignature.mockReturnValue(true);
    processChapaWebhook.mockResolvedValue(undefined);
    processGitHubWebhook.mockResolvedValue(undefined);
  });

  describe('receiveChapaWebhook', () => {
    it('rejects an invalid Chapa signature without scheduling processing', () => {
      verifyChapaSignature.mockReturnValue(false);
      const res = response();

      receiveChapaWebhook(chapaRequest('{"tx_ref":"tx-1"}', 'bad'), res as never);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
      expect(processChapaWebhook).not.toHaveBeenCalled();
    });

    it('throws a 400 when the raw body was not captured', () => {
      expect(() =>
        receiveChapaWebhook({ get: () => 'sig' } as never, response() as never),
      ).toThrow('Invalid webhook payload');
    });

    it('rejects a body that is not valid JSON', () => {
      const res = response();

      receiveChapaWebhook(chapaRequest('not json'), res as never);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(processChapaWebhook).not.toHaveBeenCalled();
    });

    it('rejects a payload without a transaction reference', () => {
      const res = response();

      receiveChapaWebhook(chapaRequest('{"status":"success"}'), res as never);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(processChapaWebhook).not.toHaveBeenCalled();
    });

    it('acknowledges a valid payload and processes it with a tx_ref:status event key', () => {
      const res = response();

      receiveChapaWebhook(chapaRequest('{"tx_ref":"tx-1","status":"Success"}'), res as never);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(processChapaWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ tx_ref: 'tx-1' }),
        'tx-1:success',
      );
    });

    it('falls back to the nested data object and the event name for the event key', () => {
      receiveChapaWebhook(chapaRequest('{"data":{"tx_ref":"tx-2"},"event":"charge.success"}'), response() as never);

      expect(processChapaWebhook).toHaveBeenCalledWith(expect.anything(), 'tx-2:charge.success');
    });

    it('uses an unknown status in the event key when none is sent', () => {
      receiveChapaWebhook(chapaRequest('{"tx_ref":"tx-3"}'), response() as never);

      expect(processChapaWebhook).toHaveBeenCalledWith(expect.anything(), 'tx-3:unknown');
    });

    it('logs a processing failure after the response has been sent', async () => {
      const failure = new Error('processing failed');
      processChapaWebhook.mockRejectedValue(failure);
      const res = response();

      receiveChapaWebhook(chapaRequest('{"tx_ref":"tx-1","status":"success"}'), res as never);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(logWebhookProcessingFailure).toHaveBeenCalledWith('chapa', failure);
    });
  });

  describe('receiveGitHubWebhook', () => {
    it('rejects an invalid GitHub signature without scheduling processing', () => {
      verifyGitHubSignature.mockReturnValue(false);
      const res = response();

      receiveGitHubWebhook(githubRequest('{}'), res as never);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
      expect(processGitHubWebhook).not.toHaveBeenCalled();
    });

    it('rejects a delivery without a delivery id', () => {
      const res = response();

      receiveGitHubWebhook(githubRequest('{}', { 'x-github-delivery': undefined }), res as never);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(processGitHubWebhook).not.toHaveBeenCalled();
    });

    it('rejects a body that is not valid JSON', () => {
      const res = response();

      receiveGitHubWebhook(githubRequest('not json'), res as never);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(processGitHubWebhook).not.toHaveBeenCalled();
    });

    it('acknowledges a valid GitHub delivery before asynchronous processing', () => {
      const res = response();
      const body = JSON.stringify({
        action: 'completed',
        workflow_run: { head_sha: 'sha-1' },
        repository: { full_name: 'Lab-Lynx/example' },
      });

      receiveGitHubWebhook(githubRequest(body), res as never);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalled();
      expect(processGitHubWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'completed' }),
        'delivery-1',
        'workflow_run',
      );
    });

    it('passes an empty event type when the event header is missing', () => {
      receiveGitHubWebhook(githubRequest('{}', { 'x-github-event': undefined }), response() as never);

      expect(processGitHubWebhook).toHaveBeenCalledWith(expect.anything(), 'delivery-1', '');
    });

    it('logs a processing failure after the response has been sent', async () => {
      const failure = new Error('processing failed');
      processGitHubWebhook.mockRejectedValue(failure);

      receiveGitHubWebhook(githubRequest('{}'), response() as never);
      await flushPromises();

      expect(logWebhookProcessingFailure).toHaveBeenCalledWith('github', failure);
    });
  });
});
