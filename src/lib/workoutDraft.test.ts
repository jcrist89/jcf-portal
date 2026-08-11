import { describe, it, expect } from "vitest";
import { reconcileSets, type SetInput } from "@/lib/workoutDraft";

const blank = (): SetInput => ({ reps: "", weight: "", rpe: "" });
const typed = (weight: string): SetInput => ({ reps: "8", weight, rpe: "8" });

describe("reconcileSets", () => {
  it("keeps what the client typed for exercises that still exist", () => {
    const out = reconcileSets(
      { Squat: [typed("315")], Bench: [typed("225")] },
      { Squat: [blank()], Bench: [blank()] },
    );
    expect(out.Squat[0].weight).toBe("315");
    expect(out.Bench[0].weight).toBe("225");
  });

  it("falls back to prescribed defaults for an exercise the draft never saw", () => {
    // Coach added "Leg Press" after the client started this session.
    const out = reconcileSets({ Squat: [typed("315")] }, { Squat: [blank()], "Leg Press": [typed("400")] });
    expect(out.Squat[0].weight).toBe("315");
    expect(out["Leg Press"][0].weight).toBe("400");
  });

  it("drops draft entries for exercises no longer in the program", () => {
    const out = reconcileSets({ Squat: [typed("315")], "Removed Lift": [typed("100")] }, { Squat: [blank()] });
    expect(Object.keys(out)).toEqual(["Squat"]);
  });

  it("guarantees an entry for every current exercise, so the save path never indexes undefined", () => {
    const defaults = { Squat: [blank()], Bench: [blank()], Row: [blank()] };
    const degraded: (Record<string, SetInput[]> | undefined)[] = [
      undefined,
      {},
      { Squat: [] },
      { Squat: null as unknown as SetInput[] },
    ];
    for (const saved of degraded) {
      const out = reconcileSets(saved, defaults);
      expect(Object.keys(out).sort()).toEqual(["Bench", "Row", "Squat"]);
      for (const name of Object.keys(defaults)) expect(Array.isArray(out[name])).toBe(true);
    }
  });

  it("preserves a set list longer than prescribed (an approved joker set appends one)", () => {
    const out = reconcileSets({ Bench: [typed("225"), typed("245"), typed("275")] }, { Bench: [blank(), blank()] });
    expect(out.Bench).toHaveLength(3);
    expect(out.Bench[2].weight).toBe("275");
  });
});
