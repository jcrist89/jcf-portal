import type { SupabaseClient } from "@supabase/supabase-js";

export type EventLevel = "info" | "warning" | "error";

/**
 * Structured, persisted logging for operational failures (cron, webhook, push,
 * workout saves) — visible to the coach in-app, not just in Vercel's raw
 * function logs. Always logs to console too (existing behavior, cheap, and a
 * fallback if the DB write itself fails). Never throws — a logging failure
 * must never mask or replace the original error it was trying to record.
 *
 * `context` must never contain secrets, tokens, passwords, payment details, or
 * sensitive health information — only IDs and short descriptive fields.
 */
export async function logEvent(
  admin: SupabaseClient,
  event: { level: EventLevel; source: string; message: string; context?: Record<string, unknown>; profileId?: string | null },
): Promise<void> {
  const logFn = event.level === "error" ? console.error : event.level === "warning" ? console.warn : console.log;
  logFn(`[${event.source}] ${event.message}`, event.context ?? {});

  try {
    const { error } = await admin.from("event_log").insert({
      level: event.level,
      source: event.source,
      message: event.message,
      context: event.context ?? {},
      profile_id: event.profileId ?? null,
    });
    if (error) {
      console.error("[eventLog] failed to persist event", { source: event.source, error: error.message });
    }
  } catch (err) {
    console.error("[eventLog] failed to persist event", { source: event.source, error: (err as Error)?.message });
  }
}
