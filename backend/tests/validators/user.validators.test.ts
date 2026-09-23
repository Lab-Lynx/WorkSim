import { describe, expect, it } from 'vitest';
import { updateDisplayNameSchema } from '../../src/validators/user.validators.js';

describe('user.validators', () => {
  it('accepts a trimmed name of at least 2 characters', async () => {
    const parsed = await updateDisplayNameSchema.parseAsync({
      body: { name: '  Ada  ' },
    });
    expect(parsed.body.name).toBe('Ada');
  });

  it('rejects whitespace-only and too-short names', async () => {
    await expect(
      updateDisplayNameSchema.parseAsync({ body: { name: '   ' } }),
    ).rejects.toBeTruthy();
    await expect(
      updateDisplayNameSchema.parseAsync({ body: { name: 'A' } }),
    ).rejects.toBeTruthy();
  });
});
