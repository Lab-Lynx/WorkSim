import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/integrations/chapa', () => ({
  verifyChapaWebhookSignature: vi.fn(),
}));

vi.mock('../../../src/services/subscription.service', () => ({
  processChapaWebhook: vi.fn(),
}));

vi.mock('../../../src/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { verifyChapaWebhookSignature } from '../../../src/integrations/chapa';
import { processChapaWebhook } from '../../../src/services/subscription.service';
import { logger } from '../../../src/lib/logger';
import { handleChapaWebhook } from '../../../src/controllers/webhooks/chapa.controller';

function mockReq(body: object, headers: Record<string, string> = {}) {
  return {
    body: Buffer.from(JSON.stringify(body)),
    header: (name: string) => headers[name.toLowerCase()] ?? headers[name],
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleChapaWebhook', () => {
  it('responds 401 and never calls processChapaWebhook when the signature is invalid', async () => {
    (verifyChapaWebhookSignature as any).mockReturnValue(false);
    const req = mockReq({ tx_ref: 'x', status: 'success' }, { 'x-chapa-signature': 'bad' });
    const res = mockRes();

    await handleChapaWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(processChapaWebhook).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('checks both possible signature headers, passing both to the verifier', async () => {
    (verifyChapaWebhookSignature as any).mockReturnValue(true);
    (processChapaWebhook as any).mockResolvedValue(undefined);
    const req = mockReq(
      { tx_ref: 'x', status: 'success' },
      { 'chapa-signature': 'sig-a', 'x-chapa-signature': 'sig-b' },
    );
    const res = mockRes();

    await handleChapaWebhook(req, res);

    expect(verifyChapaWebhookSignature).toHaveBeenCalledWith(
      req.body,
      expect.objectContaining({ chapaSignature: 'sig-a', xChapaSignature: 'sig-b' }),
    );
  });

  it('responds 400 on a malformed payload (missing tx_ref or status), before calling the service', async () => {
    (verifyChapaWebhookSignature as any).mockReturnValue(true);
    const req = mockReq({ tx_ref: 'x' }, { 'x-chapa-signature': 'good' }); // status missing
    const res = mockRes();

    await handleChapaWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(processChapaWebhook).not.toHaveBeenCalled();
  });

  it('responds 200 and calls processChapaWebhook for a valid, well-formed event', async () => {
    (verifyChapaWebhookSignature as any).mockReturnValue(true);
    (processChapaWebhook as any).mockResolvedValue(undefined);
    const req = mockReq({ tx_ref: 'tx-1', status: 'success' }, { 'x-chapa-signature': 'good' });
    const res = mockRes();

    await handleChapaWebhook(req, res);

    expect(processChapaWebhook).toHaveBeenCalledWith({ tx_ref: 'tx-1', status: 'success' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('responds 200 even for an unknown transaction reference (the service logs it, not the controller)', async () => {
    (verifyChapaWebhookSignature as any).mockReturnValue(true);
    (processChapaWebhook as any).mockResolvedValue(undefined); // service handles "unknown" internally
    const req = mockReq(
      { tx_ref: 'never-seen', status: 'success' },
      { 'x-chapa-signature': 'good' },
    );
    const res = mockRes();

    await handleChapaWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('responds 200 even if the service throws (repeated/already-terminal events must not error out)', async () => {
    (verifyChapaWebhookSignature as any).mockReturnValue(true);
    (processChapaWebhook as any).mockRejectedValue(new Error('unexpected'));
    const req = mockReq({ tx_ref: 'tx-2', status: 'success' }, { 'x-chapa-signature': 'good' });
    const res = mockRes();

    await handleChapaWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(logger.error).toHaveBeenCalled();
  });

  it('logs received, verified, and processing distinctly, without logging a rejection on a good request', async () => {
    (verifyChapaWebhookSignature as any).mockReturnValue(true);
    (processChapaWebhook as any).mockResolvedValue(undefined);
    const req = mockReq({ tx_ref: 'tx-3', status: 'success' }, { 'x-chapa-signature': 'good' });
    const res = mockRes();

    await handleChapaWebhook(req, res);

    expect(logger.info).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
