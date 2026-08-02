import type { SupabaseClient } from "@supabase/supabase-js";

export type TimelineEventType =
  | "workout_completed"
  | "workout_incomplete"
  | "measurement"
  | "pr"
  | "achievement"
  | "readiness_checkin"
  | "joker_request"
  | "message";

export interface TimelineEvent {
  type: TimelineEventType;
  date: string; // ISO timestamp, used for sorting/cursor
  summary: string;
  detail?: string;
}

const PAGE_SOURCE_LIMIT = 25;

/**
 * Builds one page of a client's chronological activity feed by pulling a bounded
 * window from each relevant table (not one unbounded fetch per table — see
 * AUTHORIZATION.md/coach detail page for the older unbounded pattern this
 * deliberately avoids), normalizing into a common shape, merging, and returning
 * only the newest `limit` events plus a cursor for the next page.
 *
 * Deliberately excludes: raw Stripe/billing details (customer ids, amounts),
 * and any other internal-system fields — this is a client-activity view, not an
 * account-internals view. Program edits and tier/subscription changes aren't
 * included because no historical record of them exists in the schema today
 * (only current state is stored) — see MIGRATION_SYNC_REPORT.md.
 */
export async function fetchClientTimelinePage(
  client: SupabaseClient,
  profileId: string,
  opts: { before?: string; limit?: number } = {},
): Promise<{ events: TimelineEvent[]; nextCursor: string | null }> {
  const limit = opts.limit ?? 25;
  const before = opts.before ?? new Date().toISOString();

  const [{ data: workouts }, { data: measurements }, { data: prs }, { data: achievements }, { data: readiness }, { data: jokers }, { data: notes }] =
    await Promise.all([
      client
        .from("workout_logs")
        .select("id, date, day_label, completed, created_at")
        .eq("profile_id", profileId)
        .lt("created_at", before)
        .order("created_at", { ascending: false })
        .limit(PAGE_SOURCE_LIMIT),
      client
        .from("measurements")
        .select("id, date, weight, waist, created_at")
        .eq("profile_id", profileId)
        .lt("created_at", before)
        .order("created_at", { ascending: false })
        .limit(PAGE_SOURCE_LIMIT),
      client
        .from("prs")
        .select("id, lift, weight, unit, reps, date, created_at")
        .eq("profile_id", profileId)
        .lt("created_at", before)
        .order("created_at", { ascending: false })
        .limit(PAGE_SOURCE_LIMIT),
      client
        .from("achievements")
        .select("id, title, created_at")
        .eq("profile_id", profileId)
        .lt("created_at", before)
        .order("created_at", { ascending: false })
        .limit(PAGE_SOURCE_LIMIT),
      client
        .from("readiness_checkins")
        .select("id, tier, score, created_at")
        .eq("profile_id", profileId)
        .lt("created_at", before)
        .order("created_at", { ascending: false })
        .limit(PAGE_SOURCE_LIMIT),
      client
        .from("joker_requests")
        .select("id, lift, status, requested_at")
        .eq("profile_id", profileId)
        .lt("requested_at", before)
        .order("requested_at", { ascending: false })
        .limit(PAGE_SOURCE_LIMIT),
      client
        .from("coach_notes")
        .select("id, author, message, created_at")
        .eq("profile_id", profileId)
        .lt("created_at", before)
        .order("created_at", { ascending: false })
        .limit(PAGE_SOURCE_LIMIT),
    ]);

  const events: TimelineEvent[] = [];

  for (const w of workouts ?? []) {
    events.push({
      type: w.completed ? "workout_completed" : "workout_incomplete",
      date: w.created_at,
      summary: w.completed ? `Completed workout${w.day_label ? `: ${w.day_label}` : ""}` : `Started workout${w.day_label ? `: ${w.day_label}` : ""} (not finished)`,
    });
  }
  for (const m of measurements ?? []) {
    const parts = [];
    if (m.weight != null) parts.push(`${m.weight} lb`);
    if (m.waist != null) parts.push(`waist ${m.waist} in`);
    events.push({ type: "measurement", date: m.created_at, summary: "Logged a check-in", detail: parts.join(", ") || undefined });
  }
  for (const p of prs ?? []) {
    events.push({ type: "pr", date: p.created_at, summary: `New PR — ${p.lift}`, detail: `${p.weight} ${p.unit ?? "lb"} x ${p.reps}` });
  }
  for (const a of achievements ?? []) {
    events.push({ type: "achievement", date: a.created_at, summary: `Earned a badge — ${a.title}` });
  }
  for (const r of readiness ?? []) {
    events.push({ type: "readiness_checkin", date: r.created_at, summary: `Readiness check-in — ${r.tier} (${r.score}/100)` });
  }
  for (const j of jokers ?? []) {
    events.push({ type: "joker_request", date: j.requested_at, summary: `Joker set on ${j.lift} — ${j.status}` });
  }
  for (const n of notes ?? []) {
    const from = n.author === "coach" ? "You" : "Client";
    const preview = n.message.length > 80 ? `${n.message.slice(0, 80)}…` : n.message;
    events.push({ type: "message", date: n.created_at, summary: `${from} sent a message`, detail: preview });
  }

  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const page = events.slice(0, limit);
  const nextCursor = page.length === limit ? page[page.length - 1].date : null;

  return { events: page, nextCursor };
}
