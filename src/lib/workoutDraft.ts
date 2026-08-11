export interface SetInput {
  reps: string;
  weight: string;
  rpe: string;
}

/**
 * Merges a saved workout draft onto the day's prescribed defaults, keyed by the
 * exercise names the program has *right now*.
 *
 * Drafts outlive program edits: a client can start typing a session, then have
 * the coach rename, add, or remove an exercise before they hit save. Applying
 * such a draft verbatim leaves `sets` missing an entry the save path indexes
 * into unconditionally — which threw inside a try/finally with no catch, so the
 * Save button went permanently dead with no visible error. Reconciling means a
 * stale draft degrades to the prescribed defaults for whatever changed and
 * keeps the client's typed values for everything that didn't.
 */
export function reconcileSets(
  saved: Record<string, SetInput[]> | undefined,
  defaults: Record<string, SetInput[]>,
): Record<string, SetInput[]> {
  const out: Record<string, SetInput[]> = {};
  for (const [name, fallback] of Object.entries(defaults)) {
    const savedSets = saved?.[name];
    // A longer-than-prescribed list is legitimate — an approved joker set
    // appends one — so a saved entry is taken whole rather than length-matched.
    out[name] = Array.isArray(savedSets) && savedSets.length > 0 ? savedSets : fallback;
  }
  return out;
}
