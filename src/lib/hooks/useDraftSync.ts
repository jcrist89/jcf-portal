"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearLocalDraft, writeLocalDraft } from "@/lib/localDraft";

export type DraftSyncStatus = "idle" | "saving" | "saved" | "synced" | "offline";

const DEBOUNCE_MS = 750;

/**
 * Two-layer draft protection for a form:
 *  1. Local: every meaningful change is debounced and written to localStorage
 *     (instant on the next tick, works fully offline).
 *  2. Server: the same debounced tick also best-effort upserts the draft to
 *     the form_drafts staging table, so a lost/wiped device can still recover
 *     it. Failures here (offline, etc.) are silent — the local copy is still
 *     safe, and an `online` listener retries once connectivity returns.
 *
 * Callers are responsible for reading the initial value themselves (via
 * readLocalDraft in a lazy useState initializer) before the first render, so
 * there's no flash of a blank form while this hook spins up.
 */
export function useDraftSync<T>({
  localKey,
  formType,
  draftKey,
  data,
  enabled = true,
}: {
  localKey: string;
  formType: "workout" | "measurement" | "pr";
  draftKey: string;
  data: T;
  enabled?: boolean;
}) {
  const [status, setStatus] = useState<DraftSyncStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const dataRef = useRef(data);
  dataRef.current = data;
  const isFirstRun = useRef(true);

  const syncToServer = useCallback(async () => {
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formType, draftKey, payload: dataRef.current }),
      });
      setStatus(res.ok ? "synced" : "saved");
    } catch {
      setStatus("offline");
    }
  }, [formType, draftKey]);

  const serializedData = JSON.stringify(data);

  useEffect(() => {
    if (!enabled) return;
    // Skip the very first run so mounting with a freshly-rehydrated draft
    // doesn't immediately re-save it before the user has changed anything.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setStatus("saving");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      writeLocalDraft(localKey, dataRef.current);
      setStatus("saved");
      syncToServer();
    }, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedData, enabled, localKey]);

  useEffect(() => {
    function retry() {
      syncToServer();
    }
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [syncToServer]);

  const clear = useCallback(() => {
    clearTimeout(timerRef.current);
    clearLocalDraft(localKey);
    setStatus("idle");
    fetch("/api/drafts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formType, draftKey }),
    }).catch(() => {
      // Local draft is already gone, which is what matters most; a leftover
      // server-side draft row is harmless and gets overwritten or expires.
    });
  }, [localKey, formType, draftKey]);

  return { status, clear };
}
