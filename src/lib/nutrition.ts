import type { NutritionEntry, NutritionFood } from "@/lib/types";

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function scaledFood(food: Pick<NutritionFood, "calories" | "protein_grams" | "carb_grams" | "fat_grams">, servings: number): NutritionTotals {
  return {
    calories: round(food.calories * servings),
    protein: round(food.protein_grams * servings),
    carbs: round(food.carb_grams * servings),
    fat: round(food.fat_grams * servings),
  };
}

export function entryTotals(entries: NutritionEntry[]): NutritionTotals {
  return entries.reduce<NutritionTotals>((total, entry) => ({
    calories: round(total.calories + Number(entry.calories)),
    protein: round(total.protein + Number(entry.protein_grams)),
    carbs: round(total.carbs + Number(entry.carb_grams)),
    fat: round(total.fat + Number(entry.fat_grams)),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}
