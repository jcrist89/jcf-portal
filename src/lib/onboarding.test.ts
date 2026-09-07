import { describe, expect, it } from "vitest";
import {
  calculateNutritionTargets,
  fitProgramToTrainingDays,
  heightToInches,
  weightToPounds,
} from "./onboarding";

describe("calculateNutritionTargets", () => {
  it("uses a 15% fat-loss deficit and recalculates macros from the target", () => {
    expect(calculateNutritionTargets(200, "fat_loss")).toEqual({
      maintenanceCalories: 2400,
      targetCalories: 2040,
      proteinGrams: 179,
      carbGrams: 204,
      fatGrams: 57,
    });
  });

  it("never assigns fewer than 1,800 calories", () => {
    expect(calculateNutritionTargets(150, "fat_loss").targetCalories).toBe(1800);
    expect(calculateNutritionTargets(120, "recomposition").targetCalories).toBe(1800);
  });

  it("caps the fat-loss deficit at 500 calories for larger clients", () => {
    expect(calculateNutritionTargets(300, "fat_loss")).toMatchObject({
      maintenanceCalories: 3600,
      targetCalories: 3100,
    });
  });

  it("keeps the maintenance/building target for the other goals", () => {
    expect(calculateNutritionTargets(180, "muscle_gain").targetCalories).toBe(2160);
    expect(calculateNutritionTargets(180, "recomposition").targetCalories).toBe(2160);
    expect(calculateNutritionTargets(180, "strength").targetCalories).toBe(2160);
  });
});

describe("unit normalization", () => {
  it("converts metric onboarding values to canonical imperial storage", () => {
    expect(weightToPounds(100, "metric")).toBeCloseTo(220.462, 3);
    expect(heightToInches(180, "metric")).toBeCloseTo(70.866, 3);
  });
});

describe("fitProgramToTrainingDays", () => {
  it("selects evenly spaced sessions and renumbers them", () => {
    const structure = {
      weeks: [{
        week: 1,
        days: Array.from({ length: 5 }, (_, index) => ({
          day: index + 1,
          label: `Day ${index + 1}`,
          exercises: [],
        })),
      }],
    };

    const result = fitProgramToTrainingDays(structure, 3);
    expect(result.weeks[0].days.map((day) => day.label)).toEqual(["Day 1", "Day 3", "Day 5"]);
    expect(result.weeks[0].days.map((day) => day.day)).toEqual([1, 2, 3]);
  });
});
