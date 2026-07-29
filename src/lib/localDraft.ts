/**
 * Local-first draft storage. Synchronous, offline-safe, no network dependency.
 * Drafts older than DRAFT_MAX_AGE_MS are treated as expired rather than
 * silently resurrecting stale data on a new session.
 */

const DRAFT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface DraftEnvelope<T> {
  data: T;
  savedAt: number;
}

export function readLocalDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeLocalDraft<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: DraftEnvelope<T> = { data, savedAt: Date.now() };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Storage full/unavailable (e.g. private browsing) — local draft safety
    // is best-effort; the form still works, it just won't survive a reload.
  }
}

export function clearLocalDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
