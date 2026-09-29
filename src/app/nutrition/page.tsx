import { ClientNav } from "@/components/ClientNav";
import { NutritionView } from "@/components/NutritionView";
import { requireUser } from "@/lib/auth/require";
import { trainingDateIn } from "@/lib/localDate";
import type { FoodFavorite, NutritionEntry, NutritionFood, SavedMeal, SavedMealItem } from "@/lib/types";

export default async function NutritionPage() {
  const { client, session, profile } = await requireUser("client");
  const localDate = trainingDateIn(profile.timezone);
  const [{ data: foods }, { data: favorites }, { data: meals }, { data: entries }] = await Promise.all([
    client.from("nutrition_foods").select("*").eq("profile_id", session.id).order("name", { ascending: true }),
    client.from("food_favorites").select("*").eq("profile_id", session.id),
    client.from("saved_meals").select("*").eq("profile_id", session.id).order("name", { ascending: true }),
    client.from("nutrition_entries").select("*").eq("profile_id", session.id).eq("local_date", localDate).order("created_at", { ascending: false }),
  ]);
  const mealIds = (meals ?? []).map((meal: any) => meal.id);
  const { data: mealItems } = mealIds.length ? await client.from("saved_meal_items").select("*").in("meal_id", mealIds) : { data: [] };

  return <div className="pb-24"><ClientNav /><main id="main-content" tabIndex={-1} className="px-4 pt-6 max-w-2xl mx-auto"><h1 className="font-display text-4xl uppercase leading-none tracking-wide mb-1">Nutrition</h1><p className="text-jcf-gray text-sm mb-6">Build repeatable meals and keep today&apos;s intake practical.</p><NutritionView localDate={localDate} targets={{ calories: profile.target_calories, protein: profile.protein_grams, carbs: profile.carb_grams, fat: profile.fat_grams }} initial={{ foods: (foods ?? []) as NutritionFood[], favorites: (favorites ?? []) as FoodFavorite[], meals: (meals ?? []) as SavedMeal[], mealItems: (mealItems ?? []) as SavedMealItem[], entries: (entries ?? []) as NutritionEntry[] }} /></main></div>;
}
