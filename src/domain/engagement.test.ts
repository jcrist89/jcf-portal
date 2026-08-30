import { describe, it, expect } from "vitest";
import {
  engagementPosition,
  entitlementsFor,
  nextCheckinDue,
  type Engagement,
  type EngagementStatus,
} from "./engagement";

function make(over: Partial<Engagement> = {}): Engagement {
  return {
    id: "e1",
    profile_id: "c1",
    offer_code: "JCF_COACHING_12W_PIF",
    agreed_amount_cents: 99700,
    currency: "USD",
    starts_on: "2026-08-02",
    ends_on: "2026-10-25",
    engagement_weeks: 12,
    checkin_weekday: 0,
    day_boundary_hour: 4,
    billing_kind: "stripe_payment",
    rate_kind: "standard",
    status: "active",
    mode: "general",
    ...over,
  };
}

const on = (d: string) => new Date(`${d}T12:00:00Z`);

describe("engagementPosition — a fixed-term engagement", () => {
  it("reports the week and the total", () => {
    const pos = engagementPosition(make(), on("2026-08-30"));
    expect(pos.week).toBe(5);
    expect(pos.totalWeeks).toBe(12);
    expect(pos.label).toBe("Week 5 of 12");
  });

  it("counts the first day as week 1", () => {
    expect(engagementPosition(make(), on("2026-08-02")).week).toBe(1);
  });

  it("has no week before it starts", () => {
    const pos = engagementPosition(make(), on("2026-07-20"));
    expect(pos.week).toBeNull();
    expect(pos.label).toBeNull();
  });

  it("reports weeks remaining, never negative", () => {
    expect(engagementPosition(make(), on("2026-08-30")).weeksRemaining).toBe(8);
    expect(engagementPosition(make(), on("2026-11-30")).weeksRemaining).toBe(0);
  });
});

describe("engagementPosition — bound to an event date", () => {
  // Stuart: engagement runs to a meet on 31 Oct, not to a 12-week term. The dates are
  // the fact; the stored week count is only an approximation of them.
  const toTheMeet = () =>
    make({ starts_on: "2026-08-02", ends_on: "2026-10-31", engagement_weeks: 12, mode: "meet_prep" });

  it("derives the total from the dates, not from engagement_weeks", () => {
    const pos = engagementPosition(toTheMeet(), on("2026-08-30"));
    expect(pos.totalWeeks).toBe(13); // 90 days, not the stored 12
    expect(pos.label).toBe("Week 5 of 13");
  });

  it("counts down to the event", () => {
    expect(engagementPosition(toTheMeet(), on("2026-08-30")).daysRemaining).toBe(62);
  });
});

describe("engagementPosition — open-ended", () => {
  // Nicole: complimentary, no agreed finish.
  const comp = () =>
    make({ ends_on: null, engagement_weeks: null, billing_kind: "complimentary", rate_kind: "comp" });

  it("still knows which week the client is in", () => {
    expect(engagementPosition(comp(), on("2026-08-30")).week).toBe(5);
  });

  it("shows no label rather than an invented total", () => {
    const pos = engagementPosition(comp(), on("2026-08-30"));
    expect(pos.isOpenEnded).toBe(true);
    expect(pos.totalWeeks).toBeNull();
    expect(pos.label).toBeNull();
  });

  it("never comes up for renewal and never expires", () => {
    const pos = engagementPosition(comp(), on("2027-06-01"));
    expect(pos.renewalDue).toBe(false);
    expect(pos.archived).toBe(false);
    expect(pos.inGracePeriod).toBe(false);
  });
});

describe("engagementPosition — renewal timing", () => {
  it("surfaces inside the 14-day window and not before it", () => {
    // ends_on is 2026-10-25.
    expect(engagementPosition(make(), on("2026-10-10")).renewalDue).toBe(false); // 15 days out
    expect(engagementPosition(make(), on("2026-10-11")).renewalDue).toBe(true); // 14 days out
    expect(engagementPosition(make(), on("2026-10-24")).renewalDue).toBe(true);
  });

  it("stays up through the grace period — the conversation is still winnable", () => {
    const pos = engagementPosition(make(), on("2026-11-10"));
    expect(pos.inGracePeriod).toBe(true);
    expect(pos.renewalDue).toBe(true);
  });

  it("stops once the engagement is archived", () => {
    const pos = engagementPosition(make(), on("2026-12-10"));
    expect(pos.archived).toBe(true);
    expect(pos.renewalDue).toBe(false);
  });

  it("does not chase a client who already renewed", () => {
    expect(engagementPosition(make({ status: "renewed" }), on("2026-10-20")).renewalDue).toBe(false);
  });
});

describe("entitlementsFor", () => {
  it("grants a complimentary client exactly what a paid one gets", () => {
    const paid = entitlementsFor(make(), on("2026-08-30"));
    const comp = entitlementsFor(
      make({ billing_kind: "complimentary", rate_kind: "comp", agreed_amount_cents: 0, ends_on: null }),
      on("2026-08-30"),
    );
    expect(comp.canTrain).toBe(paid.canTrain);
    expect(comp.canMessage).toBe(paid.canMessage);
  });

  it("keeps a past_due client training rather than turning a billing hiccup into churn", () => {
    const e = entitlementsFor(make({ status: "past_due" }), on("2026-08-30"));
    expect(e.canTrain).toBe(true);
    expect(e.canMessage).toBe(true);
  });

  it("goes read-only for the grace window after the end, messaging still open", () => {
    const e = entitlementsFor(make(), on("2026-11-10"));
    expect(e.canTrain).toBe(false);
    expect(e.canMessage).toBe(true);
    expect(e.readOnly).toBe(true);
    expect(e.archived).toBe(false);
  });

  it("archives past the grace window", () => {
    const e = entitlementsFor(make(), on("2026-12-10"));
    expect(e.archived).toBe(true);
    expect(e.canMessage).toBe(false);
  });

  it("shuts a canceled engagement immediately", () => {
    const e = entitlementsFor(make({ status: "canceled" }), on("2026-08-30"));
    expect(e.canTrain).toBe(false);
    expect(e.archived).toBe(true);
  });

  it("gives nothing when there is no engagement at all", () => {
    const e = entitlementsFor(null);
    expect(e.canTrain).toBe(false);
    expect(e.readOnly).toBe(true);
  });

  const liveStatuses: EngagementStatus[] = ["pending", "active", "past_due"];
  it.each(liveStatuses)("treats %s as live", (status) => {
    expect(entitlementsFor(make({ status }), on("2026-08-30")).canTrain).toBe(true);
  });
});

describe("nextCheckinDue", () => {
  it("finds the next occurrence of the client's check-in weekday", () => {
    // 2026-08-30 is a Sunday; checkin_weekday 0 = Sunday.
    expect(nextCheckinDue(make(), on("2026-08-30"))?.getDay()).toBe(0);
  });

  it("looks forward when today is past this week's day", () => {
    const due = nextCheckinDue(make({ checkin_weekday: 3 }), on("2026-08-30"));
    expect(due?.getDay()).toBe(3);
  });

  it("returns null without an engagement", () => {
    expect(nextCheckinDue(null)).toBeNull();
  });
});
