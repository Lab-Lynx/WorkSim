const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
  /loading (css )?chunk [\w-]+ failed/i,
];

const RELOAD_GUARD_KEY = 'worksim:chunk-reload-at';
const RELOAD_GUARD_WINDOW_MS = 10_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error && error.name === 'ChunkLoadError') return true;

  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function canReloadForChunkError(): boolean {
  try {
    const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    return Date.now() - lastReload >= RELOAD_GUARD_WINDOW_MS;
  } catch {
    return false;
  }
}

/**
 * A stale tab asks for hashed files that a newer deploy removed. Reloading
 * fetches the fresh index.html. The guard stops a reload loop when the file is
 * genuinely missing (returns true only if a reload was triggered).
 */
export function reloadOnceForChunkError(): boolean {
  try {
    const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    if (Date.now() - lastReload < RELOAD_GUARD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    return false;
  }

  window.location.reload();
  return true;
}
