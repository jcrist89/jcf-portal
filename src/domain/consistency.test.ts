import { describe, it, expect } from "vitest";
import {
  consistency,
  habitCount,
  isGoodDay,
  todayHabitMessage,
  type HabitDay,
} from "./consistency";

const day = (local_date: string, n: number): HabitDay => ({
  local_date,
  protein: n >= 1,
  steps: n >= 2,
  water: n >= 3,
  sleep: n >= 4,
});

/** `pattern` reads oldest-to-newest, ending today. */
function week(today: string, pattern: number[]): HabitDay[] {
  return pattern.map((n, i) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (pattern.length - 1 - i));
    return day(d.toISOString().slice(0, 10), n);
  });
}

const TODAY = "2026-08-30";

describe("the 3-of-4 rule", () => {
  it("counts a day at three habits", () => {
    expect(isGoodDay(day(TODAY, 3))).toBe(true);
    expect(isGoodDay(day(TODAY, 4))).toBe(true);
  });

  it("does not count a day at two", () => {
    expect(isGoodDay(day(TODAY, 2))).toBe(false);
  });

  it("treats a missing day as not counted, not as an error", () => {
    expect(isGoodDay(undefined)).toBe(false);
    expect(habitCount(null)).toBe(0);
  });
});

describe("consistency — rolling, not consecutive", () => {
  it("counts successful days in the last seven", () => {
    const c = consistency(week(TODAY, [4, 3, 1, 3, 0, 3, 3]), TODAY);
    expect(c.daysHit).toBe(5);
    expect(c.label).toBe("5 of last 7");
  });

  it("survives a bad day instead of resetting to zero", () => {
    // The whole reason this is not a consecutive streak: one missed night should not
    // erase a good week for a client prone to all-or-nothing thinking.
    const good = consistency(week(TODAY, [3, 3, 3, 3, 3, 3, 3]), TODAY);
    const oneOff = consistency(week(TODAY, [3, 3, 3, 0, 3, 3, 3]), TODAY);
    expect(good.daysHit).toBe(7);
    expect(oneOff.daysHit).toBe(6);
  });

  it("ignores days older than the window", () => {
    const c = consistency(week(TODAY, [4, 4, 4, 0, 0, 0, 0, 0, 0, 0]), TODAY);
    expect(c.daysHit).toBe(0);
  });

  it("shortens the window for a client who has not been going a week", () => {
    // Day three of an engagement should read "2 of 3", not "2 of 7" — the second looks
    // like failure on day three.
    const c = consistency(week(TODAY, [3, 0, 3]), TODAY, "2026-08-28");
    expect(c.windowDays).toBe(3);
    expect(c.daysHit).toBe(2);
    expect(c.label).toBe("2 of last 3");
  });

  it("never shrinks the window below one day", () => {
    expect(consistency([day(TODAY, 4)], TODAY, TODAY).windowDays).toBe(1);
  });

  it("caps the window at seven however old the engagement is", () => {
    expect(consistency([], TODAY, "2026-01-01").windowDays).toBe(7);
  });
});

describe("consistency — today", () => {
  it("reports how much of today is done", () => {
    const c = consistency([day(TODAY, 2)], TODAY);
    expect(c.todayCount).toBe(2);
    expect(c.todayCounted).toBe(false);
  });

  it("marks today counted at three", () => {
    expect(consistency([day(TODAY, 3)], TODAY).todayCounted).toBe(true);
  });

  it("handles a client with no habit rows at all", () => {
    const c = consistency([], TODAY);
    expect(c).toMatchObject({ daysHit: 0, todayCount: 0, todayCounted: false, runLength: 0 });
  });
});

describe("consistency — run length", () => {
  it("counts consecutive good days ending today", () => {
    expect(consistency(week(TODAY, [0, 3, 3, 3]), TODAY).runLength).toBe(3);
  });

  it("does not reset just because today is unfinished", () => {
    // Yesterday and the day before counted; today is only at one habit so far. The run
    // is still alive — collapsing it every morning would be its own kind of punishment.
    const c = consistency(week(TODAY, [3, 3, 1]), TODAY);
    expect(c.runLength).toBe(2);
  });

  it("is zero when yesterday was missed and today is unfinished", () => {
    expect(consistency(week(TODAY, [3, 0, 1]), TODAY).runLength).toBe(0);
  });
});

describe("todayHabitMessage", () => {
  it("names the one action that would make the day count", () => {
    expect(todayHabitMessage(day(TODAY, 2))).toBe("One more and today counts.");
  });

  it("confirms the day once it counts", () => {
    expect(todayHabitMessage(day(TODAY, 3))).toContain("today counts");
  });

  it("never scolds an empty day", () => {
    const message = todayHabitMessage(undefined);
    expect(message).toBe("Three of four makes today count.");
    expect(message.toLowerCase()).not.toContain("fail");
  });
});
