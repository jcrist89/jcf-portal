import { describe, expect, it } from "vitest";
import { restTimerStartState } from "@/lib/restTimer";

describe("restTimerStartState", () => {
  it("starts when a set has valid reps and weight", () => {
    expect(restTimerStartState({ reps: "8", weight: "135" }, false)).toEqual({
      shouldStart: true,
      hasStarted: true,
    });
  });

  it("does not start for a partial or invalid set", () => {
    expect(restTimerStartState({ reps: "8", weight: "" }, false)).toEqual({
      shouldStart: false,
      hasStarted: false,
    });
    expect(restTimerStartState({ reps: "-", weight: "135" }, false).shouldStart).toBe(false);
  });

  it("allows a deliberate zero weight but requires positive reps", () => {
    expect(restTimerStartState({ reps: "5", weight: "0" }, false).shouldStart).toBe(true);
    expect(restTimerStartState({ reps: "0", weight: "135" }, false).shouldStart).toBe(false);
  });

  it("starts once until either reps or weight is cleared", () => {
    const completed = { reps: "8", weight: "135" };
    expect(restTimerStartState(completed, true)).toEqual({ shouldStart: false, hasStarted: true });
    expect(restTimerStartState({ reps: "", weight: "135" }, true)).toEqual({
      shouldStart: false,
      hasStarted: false,
    });
    expect(restTimerStartState(completed, false).shouldStart).toBe(true);
  });
});
