const RELOAD_KEY = "medlab_chunk_reload";

/**
 * After a deploy, a tab still running the previous version asks for page chunks that no longer exist.
 * Reloading fetches the new version. At most once a minute, so a chunk that is really missing can't loop.
 * Returns false when it did not reload.
 */
export function reloadForNewVersion(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function isStaleChunkError(error: unknown) {
  return error instanceof Error && /dynamically imported module|Importing a module script failed|Loading chunk/i.test(error.message);
}
