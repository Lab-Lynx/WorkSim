import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-error';

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x.test/assets/RegisterPage-abc.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/index.css',
    'Loading chunk 42 failed.',
  ])('detects "%s"', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it('detects errors named ChunkLoadError', () => {
    const error = new Error('boom');
    error.name = 'ChunkLoadError';
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('ignores unrelated errors and empty values', () => {
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('reloadOnceForChunkError', () => {
  const reload = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    vi.stubGlobal('location', { ...window.location, reload });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reloads the first time', () => {
    expect(reloadOnceForChunkError()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload again within the guard window to avoid a loop', () => {
    expect(reloadOnceForChunkError()).toBe(true);
    expect(reloadOnceForChunkError()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
