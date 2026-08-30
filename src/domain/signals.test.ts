import { describe, it, expect } from "vitest";
import {
  signalsFor,
  applySuppressions,
  buildQueue,
  ADHERENCE_FLOOR_PCT,
  BASELINE_SUPPRESSION_WEEKS,
  type ClientSnapshot,
  type SuppressedSignal,
} from "./signals";
import type { SchedulePosition } from "@/domain/schedule";
import type { Engagement } from "@/domain/engagement";

const TODAY = "2026-08-30";
const NOW = "2026-08-30T12:00:00.000Z";

function schedule(over: Partial<SchedulePosition> = {}): SchedulePosition {
  return {
    session: null,
    dueToday: false,
    calendarWeek: 5,
    totalWeeks: 13,
    complete: false,
    sessionsBehind: 0,
    adherence: { completed: 0, scaled: 0, missed: 0, accountedFor: 0, pct: null },
    ...over,
  };
}

function engagement(over: Partial<Engagement> = {}): Engagement {
  return {
    id: "e1", profile_id: "c1", offer_code: "X", agreed_amount_cents: 0, currency: "USD",
    starts_on: "2026-06-01", ends_on: "2026-10-31", engagement_weeks: null,
    checkin_weekday: 0, day_boundary_hour: 4, billing_kind: "manual_invoice",
    rate_kind: "standard", status: "active", mode: "general", ...over,
  };
}

function snapshot(over: Partial<ClientSnapshot> = {}): ClientSnapshot {
  return {
    profileId: "c1",
    name: "Test Client",
    engagement: engagement(),
    schedule: schedule(),
    hasAssignment: true,
    lastActivityDate: TODAY,
    latestClientMessageAt: null,
    latestClientMessageId: null,
    latestClientMessagePreview: null,
    latestCoachReplyAt: null,
    scaledRecently: 0,
    scalingReasons: [],
    ...over,
  };
}

const kinds = (s: ReturnType<typeof signalsFor>) => s.map((x) => x.kind);

describe("a healthy client raises nothing", () => {
  it("produces an empty list", () => {
    expect(signalsFor(snapshot(), NOW, TODAY)).toEqual([]);
  });

  it("is absent from the queue entirely", () => {
    const queue = buildQueue([{ snapshot: snapshot(), suppressions: [] }], NOW, TODAY);
    expect(queue).toEqual([]);
  });
});

describe("unanswered message", () => {
  it("fires once past the 24-hour SLA", () => {
    const s = signalsFor(
      snapshot({
        latestClientMessageAt: "2026-08-28T09:00:00.000Z",
        latestClientMessageId: "m1",
        latestClientMessagePreview: "my knee is sore",
      }),
      NOW,
      TODAY,
    );
    expect(kinds(s)).toContain("message_unanswered");
    expect(s[0].severity).toBe("critical");
    expect(s[0].evidence).toContain("knee");
  });

  it("stays quiet inside the SLA", () => {
    const s = signalsFor(
      snapshot({ latestClientMessageAt: "2026-08-30T06:00:00.000Z", latestClientMessageId: "m1" }),
      NOW,
      TODAY,
    );
    expect(kinds(s)).not.toContain("message_unanswered");
  });

  it("is cleared by a reply, not by reading", () => {
    // The coach opening the thread is not an answer. Only a later reply counts.
    const s = signalsFor(
      snapshot({
        latestClientMessageAt: "2026-08-28T09:00:00.000Z",
        latestCoachReplyAt: "2026-08-28T10:00:00.000Z",
      }),
      NOW,
      TODAY,
    );
    expect(kinds(s)).not.toContain("message_unanswered");
  });

  it("fires again when the client writes after the last reply", () => {
    const s = signalsFor(
      snapshot({
        latestCoachReplyAt: "2026-08-20T10:00:00.000Z",
        latestClientMessageAt: "2026-08-27T09:00:00.000Z",
        latestClientMessageId: "m2",
      }),
      NOW,
      TODAY,
    );
    expect(kinds(s)).toContain("message_unanswered");
  });
});

describe("missed sessions rather than wall-clock silence", () => {
  it("escalates with the number missed", () => {
    const two = signalsFor(snapshot({ schedule: schedule({ sessionsBehind: 2 }) }), NOW, TODAY);
    const five = signalsFor(snapshot({ schedule: schedule({ sessionsBehind: 5 }) }), NOW, TODAY);
    expect(two[0].severity).toBe("high");
    expect(five[0].severity).toBe("critical");
  });

  it("stays quiet at one missed session", () => {
    const s = signalsFor(snapshot({ schedule: schedule({ sessionsBehind: 1 }) }), NOW, TODAY);
    expect(kinds(s)).not.toContain("sessions_missed");
  });

  it("does not also fire wall-clock silence for a scheduled client", () => {
    // Two signals for one condition is how a queue turns into noise.
    const s = signalsFor(
      snapshot({ schedule: schedule({ sessionsBehind: 5 }), lastActivityDate: "2026-07-01" }),
      NOW,
      TODAY,
    );
    expect(kinds(s)).not.toContain("quiet");
  });

  it("falls back to silence only when nothing is scheduled", () => {
    const s = signalsFor(
      snapshot({ hasAssignment: false, schedule: schedule(), lastActivityDate: "2026-08-10" }),
      NOW,
      TODAY,
    );
    expect(kinds(s)).toContain("quiet");
  });
});

describe("adherence", () => {
  const low = schedule({
    adherence: { completed: 3, scaled: 0, missed: 13, accountedFor: 16, pct: 19 },
  });

  it("fires below the floor once the engagement is old enough", () => {
    const s = signalsFor(snapshot({ schedule: low }), NOW, TODAY);
    expect(kinds(s)).toContain("adherence_low");
    expect(s.find((x) => x.kind === "adherence_low")!.headline).toContain("19%");
  });

  it("is suppressed for a brand-new engagement", () => {
    // A client three weeks in has no baseline to fall below, and a false alarm then is
    // the most expensive kind — it trains the coach to distrust the queue.
    const fresh = engagement({ starts_on: "2026-08-24" });
    const s = signalsFor(snapshot({ schedule: low, engagement: fresh }), NOW, TODAY);
    expect(kinds(s)).not.toContain("adherence_low");
  });

  it("starts firing exactly at the suppression boundary", () => {
    const startsOn = new Date(`${TODAY}T00:00:00Z`);
    startsOn.setUTCDate(startsOn.getUTCDate() - (BASELINE_SUPPRESSION_WEEKS - 1) * 7);
    const s = signalsFor(
      snapshot({ schedule: low, engagement: engagement({ starts_on: startsOn.toISOString().slice(0, 10) }) }),
      NOW,
      TODAY,
    );
    expect(kinds(s)).toContain("adherence_low");
  });

  it("stays quiet at the floor itself", () => {
    const atFloor = schedule({
      adherence: { completed: 6, scaled: 0, missed: 4, accountedFor: 10, pct: ADHERENCE_FLOOR_PCT },
    });
    expect(kinds(signalsFor(snapshot({ schedule: atFloor }), NOW, TODAY))).not.toContain("adherence_low");
  });
});

describe("repeated scaling", () => {
  it("fires at three and reports the reasons given", () => {
    const s = signalsFor(
      snapshot({ scaledRecently: 3, scalingReasons: ["pain", "bad_sleep", "pain"] }),
      NOW,
      TODAY,
    );
    const sig = s.find((x) => x.kind === "repeated_scaling")!;
    expect(sig).toBeDefined();
    expect(sig.evidence).toContain("pain");
    // Reasons are deduped — "pain, pain, bad_sleep" reads like a bug.
    expect(sig.evidence.match(/pain/g)).toHaveLength(1);
  });

  it("stays quiet at two", () => {
    expect(kinds(signalsFor(snapshot({ scaledRecently: 2 }), NOW, TODAY))).not.toContain("repeated_scaling");
  });

  it("frames it as information, not a discipline problem", () => {
    const s = signalsFor(snapshot({ scaledRecently: 4 }), NOW, TODAY);
    const sig = s.find((x) => x.kind === "repeated_scaling")!;
    expect(sig.action).toBe("Ask what's going on");
  });
});

describe("renewal", () => {
  it("surfaces inside the window", () => {
    const s = signalsFor(snapshot({ engagement: engagement({ ends_on: "2026-09-10" }) }), NOW, TODAY);
    expect(kinds(s)).toContain("renewal_due");
  });

  it("stays quiet outside it", () => {
    const s = signalsFor(snapshot({ engagement: engagement({ ends_on: "2026-12-01" }) }), NOW, TODAY);
    expect(kinds(s)).not.toContain("renewal_due");
  });

  it("keeps a lapsed engagement visible as still winnable", () => {
    const s = signalsFor(snapshot({ engagement: engagement({ ends_on: "2026-08-20" }) }), NOW, TODAY);
    const sig = s.find((x) => x.kind === "engagement_ended")!;
    expect(sig.severity).toBe("opportunity");
    expect(sig.evidence).toContain("winnable");
  });

  it("says nothing for an open-ended comp arrangement", () => {
    const comp = engagement({ ends_on: null, billing_kind: "complimentary", rate_kind: "comp" });
    const s = signalsFor(snapshot({ engagement: comp }), NOW, TODAY);
    expect(kinds(s)).not.toContain("renewal_due");
    expect(kinds(s)).not.toContain("engagement_ended");
  });
});

describe("ordering", () => {
  it("puts critical above high above opportunity", () => {
    const s = signalsFor(
      snapshot({
        latestClientMessageAt: "2026-08-25T09:00:00.000Z",
        latestClientMessageId: "m1",
        scaledRecently: 3,
        engagement: engagement({ ends_on: "2026-09-05" }),
      }),
      NOW,
      TODAY,
    );
    expect(s.map((x) => x.severity)).toEqual(["critical", "high", "opportunity"]);
  });

  it("ranks the worst-off client first", () => {
    const queue = buildQueue(
      [
        { snapshot: snapshot({ profileId: "a", name: "Alice", engagement: engagement({ ends_on: "2026-09-05" }) }), suppressions: [] },
        {
          snapshot: snapshot({
            profileId: "b", name: "Bob",
            latestClientMessageAt: "2026-08-25T09:00:00.000Z", latestClientMessageId: "m1",
          }),
          suppressions: [],
        },
      ],
      NOW,
      TODAY,
    );
    expect(queue.map((e) => e.name)).toEqual(["Bob", "Alice"]);
  });
});

describe("suppression", () => {
  const withMissed = snapshot({ schedule: schedule({ sessionsBehind: 2 }) });

  it("hides a resolved signal", () => {
    const suppressions: SuppressedSignal[] = [
      { signal_kind: "sessions_missed", fingerprint: "missed:2", action: "resolved", snoozed_until: null },
    ];
    const s = applySuppressions(signalsFor(withMissed, NOW, TODAY), suppressions, TODAY);
    expect(s).toEqual([]);
  });

  it("lets the same condition back through when it gets worse", () => {
    // The point of fingerprints: resolving "2 missed" must not mask "5 missed" later.
    const suppressions: SuppressedSignal[] = [
      { signal_kind: "sessions_missed", fingerprint: "missed:2", action: "resolved", snoozed_until: null },
    ];
    const worse = snapshot({ schedule: schedule({ sessionsBehind: 5 }) });
    const s = applySuppressions(signalsFor(worse, NOW, TODAY), suppressions, TODAY);
    expect(kinds(s)).toContain("sessions_missed");
  });

  it("keeps a snooze hidden until its date", () => {
    const suppressions: SuppressedSignal[] = [
      { signal_kind: "sessions_missed", fingerprint: "missed:2", action: "snoozed", snoozed_until: "2026-09-05" },
    ];
    expect(applySuppressions(signalsFor(withMissed, NOW, TODAY), suppressions, TODAY)).toEqual([]);
  });

  it("brings it back when the snooze expires", () => {
    const suppressions: SuppressedSignal[] = [
      { signal_kind: "sessions_missed", fingerprint: "missed:2", action: "snoozed", snoozed_until: "2026-08-29" },
    ];
    const s = applySuppressions(signalsFor(withMissed, NOW, TODAY), suppressions, TODAY);
    expect(kinds(s)).toContain("sessions_missed");
  });

  it("does not suppress a different kind sharing a fingerprint", () => {
    const suppressions: SuppressedSignal[] = [
      { signal_kind: "quiet", fingerprint: "missed:2", action: "resolved", snoozed_until: null },
    ];
    const s = applySuppressions(signalsFor(withMissed, NOW, TODAY), suppressions, TODAY);
    expect(kinds(s)).toContain("sessions_missed");
  });
});
