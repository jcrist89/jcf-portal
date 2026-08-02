import { describe, it, expect, vi } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";
import { logEvent } from "./eventLog";

describe("logEvent", () => {
  it("persists a structured event to event_log", async () => {
    const db = new FakeSupabase({ event_log: [] });
    await logEvent(db as any, { level: "error", source: "test.source", message: "Something broke", context: { foo: "bar" }, profileId: "p1" });
    expect(db.tables.event_log).toHaveLength(1);
    expect(db.tables.event_log[0]).toMatchObject({
      level: "error",
      source: "test.source",
      message: "Something broke",
      context: { foo: "bar" },
      profile_id: "p1",
    });
  });

  it("never throws even if the underlying insert fails", async () => {
    const brokenClient = {
      from: () => ({
        insert: () => {
          throw new Error("connection refused");
        },
      }),
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(logEvent(brokenClient as any, { level: "error", source: "x", message: "y" })).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it("defaults context to an empty object and profileId to null", async () => {
    const db = new FakeSupabase({ event_log: [] });
    await logEvent(db as any, { level: "info", source: "s", message: "m" });
    expect(db.tables.event_log[0].context).toEqual({});
    expect(db.tables.event_log[0].profile_id).toBeNull();
  });
});
