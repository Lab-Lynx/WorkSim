import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAdminKey } from '../../src/middlewares/requireAdminKey.middleware';

function mockReq(headers: Record<string, string> = {}) {
  return { header: (name: string) => headers[name.toLowerCase()] ?? headers[name] } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_MODERATION_KEY = 'super-secret-key';
});

describe('requireAdminKey', () => {
  it('calls next() with no error when the key matches', () => {
    const req = mockReq({ 'x-admin-key': 'super-secret-key' });
    const next = vi.fn();
    requireAdminKey(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(err) with 401 when the key is wrong', () => {
    const req = mockReq({ 'x-admin-key': 'wrong-key' });
    const next = vi.fn();
    requireAdminKey(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('calls next(err) with 401 when the header is missing entirely', () => {
    const req = mockReq({});
    const next = vi.fn();
    requireAdminKey(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('fails closed with 500 if ADMIN_MODERATION_KEY is not configured at all', () => {
    delete process.env.ADMIN_MODERATION_KEY;
    const req = mockReq({ 'x-admin-key': 'anything' });
    const next = vi.fn();
    requireAdminKey(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
  });
});
