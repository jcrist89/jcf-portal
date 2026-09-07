import type { Goal, ProgramStructure, UnitSystem } from "@/lib/types";

export const ONBOARDING_GOALS: Goal[] = [
  "fat_loss",
  "recomposition",
  "muscle_gain",
  "strength",
];

export interface NutritionTargets {
  maintenanceCalories: number;
  targetCalories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

export const MINIMUM_DAILY_CALORIES = 1800;
const FAT_LOSS_DEFICIT_RATE = 0.15;
const MAXIMUM_FAT_LOSS_DEFICIT = 500;

/** JCF starting targets. Weight is canonical pounds, regardless of display units. */
export function calculateNutritionTargets(weightLb: number, goal: Goal): NutritionTargets {
  const maintenanceCalories = Math.round(weightLb * 12);
  const fatLossDeficit = Math.min(
    MAXIMUM_FAT_LOSS_DEFICIT,
    Math.round(maintenanceCalories * FAT_LOSS_DEFICIT_RATE),
  );
  const startingTarget = goal === "fat_loss"
    ? maintenanceCalories - fatLossDeficit
    : maintenanceCalories;
  const targetCalories = Math.max(MINIMUM_DAILY_CALORIES, startingTarget);

  return {
    maintenanceCalories,
    targetCalories,
    proteinGrams: Math.round((targetCalories * 0.35) / 4),
    carbGrams: Math.round((targetCalories * 0.4) / 4),
    fatGrams: Math.round((targetCalories * 0.25) / 9),
  };
}

export function weightToPounds(weight: number, units: UnitSystem): number {
  return units === "metric" ? weight * 2.2046226218 : weight;
}

export function heightToInches(height: number, units: UnitSystem): number {
  return units === "metric" ? height / 2.54 : height;
}

/**
 * Preserve each template's weekly balance while matching the number of days a client
 * can consistently train. Even spacing avoids turning a 5-day template into only its
 * first three days and accidentally dropping an entire movement pattern.
 */
export function fitProgramToTrainingDays(
  structure: ProgramStructure,
  trainingDays: number,
): ProgramStructure {
  return {
    ...structure,
    weeks: structure.weeks.map((week) => {
      if (week.days.length <= trainingDays) return week;

      const indexes = Array.from({ length: trainingDays }, (_, index) =>
        Math.round((index * (week.days.length - 1)) / Math.max(1, trainingDays - 1)),
      );
      const selected = indexes.map((index) => week.days[index]);

      return {
        ...week,
        days: selected.map((day, index) => ({ ...day, day: index + 1 })),
      };
    }),
  };
}
