import { beforeAll, describe, expect, it, vi } from 'vitest';

const MAX_CHARS = 50;

vi.mock('../../src/config/env.js', () => ({
  env: { MENTOR_MESSAGE_MAX_CHARS: MAX_CHARS },
}));

const validId = '11111111-1111-4111-8111-111111111111';

let sendMentorMessageSchema: typeof import('../../src/validators/mentor.validators.js').sendMentorMessageSchema;
let getMentorMessagesParamsSchema: typeof import('../../src/validators/mentor.validators.js').getMentorMessagesParamsSchema;
let buildMentorContentSchema: typeof import('../../src/validators/mentor.validators.js').buildMentorContentSchema;

beforeAll(async () => {
  ({
    sendMentorMessageSchema,
    getMentorMessagesParamsSchema,
    buildMentorContentSchema,
  } = await import('../../src/validators/mentor.validators.js'));
});

describe('mentor.validators (doc 7 §7.2.4, Q-10b)', () => {
  it('accepts trimmed non-empty content within the configured max', async () => {
    const parsed = await sendMentorMessageSchema.parseAsync({
      params: { ticketId: validId },
      body: { content: '  help with the hook  ' },
    });

    expect(parsed.params.ticketId).toBe(validId);
    expect(parsed.body.content).toBe('help with the hook');
  });

  it('accepts content exactly at the configured max length', async () => {
    const content = 'a'.repeat(MAX_CHARS);
    const parsed = await sendMentorMessageSchema.parseAsync({
      params: { ticketId: validId },
      body: { content },
    });
    expect(parsed.body.content).toBe(content);
  });

  it('rejects empty content', async () => {
    await expect(
      sendMentorMessageSchema.parseAsync({
        params: { ticketId: validId },
        body: { content: '' },
      }),
    ).rejects.toBeTruthy();
  });

  it('rejects whitespace-only content', async () => {
    await expect(
      sendMentorMessageSchema.parseAsync({
        params: { ticketId: validId },
        body: { content: '   \n\t  ' },
      }),
    ).rejects.toBeTruthy();
  });

  it('rejects content longer than the configured maximum', async () => {
    await expect(
      sendMentorMessageSchema.parseAsync({
        params: { ticketId: validId },
        body: { content: 'a'.repeat(MAX_CHARS + 1) },
      }),
    ).rejects.toBeTruthy();
  });

  it('rejects a non-UUID ticketId', async () => {
    await expect(
      sendMentorMessageSchema.parseAsync({
        params: { ticketId: 'not-a-uuid' },
        body: { content: 'hello' },
      }),
    ).rejects.toBeTruthy();
  });

  it('strips client hint fields from the body (hint stage is server-derived)', async () => {
    const parsed = await sendMentorMessageSchema.parseAsync({
      params: { ticketId: validId },
      body: { content: 'hi', hintLevel: 3, stage: 'specific_suggestion' },
    });

    expect(parsed.body).toEqual({ content: 'hi' });
    expect(parsed.body).not.toHaveProperty('hintLevel');
    expect(parsed.body).not.toHaveProperty('stage');
  });

  it('getMentorMessagesParamsSchema accepts a UUID ticketId', async () => {
    const parsed = await getMentorMessagesParamsSchema.parseAsync({
      params: { ticketId: validId },
    });
    expect(parsed.params.ticketId).toBe(validId);
  });

  it('when max chars is unset, only enforces non-empty trimmed content (Q-10b)', () => {
    const schema = buildMentorContentSchema(undefined);
    expect(schema.parse('  ok  ')).toBe('ok');
    expect(() => schema.parse('')).toThrow();
    expect(() => schema.parse('   ')).toThrow();
    expect(schema.parse('a'.repeat(10_000))).toBe('a'.repeat(10_000));
  });
});
