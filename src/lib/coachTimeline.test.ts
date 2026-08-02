import { describe, it, expect } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";
import { fetchClientTimelinePage } from "./coachTimeline";

describe("fetchClientTimelinePage", () => {
  it("merges events from multiple tables into one chronologically sorted feed", async () => {
    const db = new FakeSupabase({
      workout_logs: [{ id: "w1", profile_id: "c1", date: "2026-01-03", day_label: "Day 1", completed: true, created_at: "2026-01-03T10:00:00Z" }],
      measurements: [{ id: "m1", profile_id: "c1", date: "2026-01-02", weight: 180, waist: null, created_at: "2026-01-02T10:00:00Z" }],
      prs: [{ id: "p1", profile_id: "c1", lift: "squat", weight: 300, unit: "lb", reps: 1, date: "2026-01-01", created_at: "2026-01-01T10:00:00Z" }],
      achievements: [],
      readiness_checkins: [],
      joker_requests: [],
      coach_notes: [],
    });

    const { events, nextCursor } = await fetchClientTimelinePage(db as any, "c1");
    expect(events.map((e) => e.type)).toEqual(["workout_completed", "measurement", "pr"]);
    expect(nextCursor).toBeNull(); // fewer than the page limit
  });

  it("scopes events to the requested profile only", async () => {
    const db = new FakeSupabase({
      workout_logs: [
        { id: "w1", profile_id: "c1", date: "2026-01-03", day_label: "Mine", completed: true, created_at: "2026-01-03T10:00:00Z" },
        { id: "w2", profile_id: "c2", date: "2026-01-03", day_label: "Someone else's", completed: true, created_at: "2026-01-03T11:00:00Z" },
      ],
      measurements: [],
      prs: [],
      achievements: [],
      readiness_checkins: [],
      joker_requests: [],
      coach_notes: [],
    });

    const { events } = await fetchClientTimelinePage(db as any, "c1");
    expect(events).toHaveLength(1);
    expect(events[0].summary).toContain("Mine");
  });

  it("paginates via a before cursor", async () => {
    const db = new FakeSupabase({
      workout_logs: Array.from({ length: 3 }, (_, i) => ({
        id: `w${i}`,
        profile_id: "c1",
        date: `2026-01-0${i + 1}`,
        day_label: `Day ${i}`,
        completed: true,
        created_at: `2026-01-0${i + 1}T10:00:00Z`,
      })),
      measurements: [],
      prs: [],
      achievements: [],
      readiness_checkins: [],
      joker_requests: [],
      coach_notes: [],
    });

    const page1 = await fetchClientTimelinePage(db as any, "c1", { limit: 2 });
    expect(page1.events).toHaveLength(2);
    expect(page1.events[0].summary).toContain("Day 2"); // newest first
    expect(page1.nextCursor).toBe(page1.events[1].date);

    const page2 = await fetchClientTimelinePage(db as any, "c1", { limit: 2, before: page1.nextCursor! });
    expect(page2.events).toHaveLength(1);
    expect(page2.events[0].summary).toContain("Day 0");
    expect(page2.nextCursor).toBeNull();
  });

  it("truncates a long message preview and labels who sent it", async () => {
    const db = new FakeSupabase({
      workout_logs: [],
      measurements: [],
      prs: [],
      achievements: [],
      readiness_checkins: [],
      joker_requests: [],
      coach_notes: [{ id: "n1", profile_id: "c1", author: "client", message: "x".repeat(100), created_at: "2026-01-01T10:00:00Z" }],
    });
    const { events } = await fetchClientTimelinePage(db as any, "c1");
    expect(events[0].summary).toBe("Client sent a message");
    expect(events[0].detail?.length).toBeLessThanOrEqual(81);
  });
});
