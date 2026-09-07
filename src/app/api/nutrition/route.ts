import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseForRequest } from "@/lib/supabase/server";
import { resolveLocalDate, trainingDateIn } from "@/lib/localDate";
import { scaledFood } from "@/lib/nutrition";

const foodSchema = z.object({
  source: z.enum(["manual", "usda"]),
  externalId: z.string().trim().min(1).max(100).nullable().optional(),
  name: z.string().trim().min(1).max(160),
  brand: z.string().trim().max(120).nullable().optional(),
  servingDescription: z.string().trim().min(1).max(120),
  servingQuantity: z.number().positive().max(10_000),
  servingUnit: z.string().trim().min(1).max(30),
  servingGrams: z.number().positive().max(10_000).nullable().optional(),
  calories: z.number().min(0).max(20_000),
  proteinGrams: z.number().min(0).max(2_000),
  carbGrams: z.number().min(0).max(2_000),
  fatGrams: z.number().min(0).max(2_000),
});
const servingsSchema = z.number().positive().max(100);

async function ownFood(client: any, profileId: string, foodId: string) {
  const { data, error } = await client.from("nutrition_foods").select("*").eq("id", foodId).eq("profile_id", profileId).maybeSingle();
  return error ? null : data;
}

function foodRecord(profileId: string, food: z.infer<typeof foodSchema>) {
  return {
    profile_id: profileId,
    source: food.source,
    external_id: food.externalId ?? null,
    name: food.name,
    brand: food.brand || null,
    serving_description: food.servingDescription,
    serving_quantity: food.servingQuantity,
    serving_unit: food.servingUnit,
    serving_grams: food.servingGrams ?? null,
    calories: food.calories,
    protein_grams: food.proteinGrams,
    carb_grams: food.carbGrams,
    fat_grams: food.fatGrams,
  };
}

async function saveFood(client: any, profileId: string, input: z.infer<typeof foodSchema>) {
  const record = foodRecord(profileId, input);
  if (input.externalId) {
    const { data: existing } = await client
      .from("nutrition_foods")
      .select("*")
      .eq("profile_id", profileId)
      .eq("source", input.source)
      .eq("external_id", input.externalId)
      .maybeSingle();
    if (existing) {
      const { data, error } = await client
        .from("nutrition_foods")
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
  }
  const { data, error } = await client.from("nutrition_foods").insert(record).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET() {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session, profile } = ctx;
  const profileId = session.id;
  const localDate = trainingDateIn(profile.timezone);

  const [{ data: foods }, { data: favorites }, { data: meals }, { data: entries }] = await Promise.all([
    client.from("nutrition_foods").select("*").eq("profile_id", profileId).order("name", { ascending: true }),
    client.from("food_favorites").select("*").eq("profile_id", profileId),
    client.from("saved_meals").select("*").eq("profile_id", profileId).order("name", { ascending: true }),
    client.from("nutrition_entries").select("*").eq("profile_id", profileId).eq("local_date", localDate).order("created_at", { ascending: false }),
  ]);
  const mealIds = (meals ?? []).map((meal: any) => meal.id);
  const { data: mealItems } = mealIds.length
    ? await client.from("saved_meal_items").select("*").in("meal_id", mealIds)
    : { data: [] };

  return NextResponse.json({ localDate, foods: foods ?? [], favorites: favorites ?? [], meals: meals ?? [], mealItems: mealItems ?? [], entries: entries ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session, profile } = ctx;
  const profileId = session.id;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    if (body.action === "saveFood") {
      const food = foodSchema.parse(body.food);
      return NextResponse.json({ food: await saveFood(client, profileId, food) });
    }

    if (body.action === "favorite") {
      const foodId = z.string().uuid().parse(body.foodId);
      if (!await ownFood(client, profileId, foodId)) return NextResponse.json({ error: "Food not found." }, { status: 404 });
      const { error } = await client.from("food_favorites").upsert({ profile_id: profileId, food_id: foodId }, { onConflict: "profile_id,food_id" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "logFood") {
      const foodId = z.string().uuid().parse(body.foodId);
      const servings = servingsSchema.parse(body.servings);
      const food = await ownFood(client, profileId, foodId);
      if (!food) return NextResponse.json({ error: "Food not found." }, { status: 404 });
      const localDate = resolveLocalDate(body.localDate, profile.timezone);
      const totals = scaledFood(food, servings);
      const { data, error } = await client.from("nutrition_entries").insert({
        profile_id: profileId, local_date: localDate, food_id: food.id, food_name: food.name,
        servings, serving_label: food.serving_description, calories: totals.calories,
        protein_grams: totals.protein, carb_grams: totals.carbs, fat_grams: totals.fat,
      }).select().single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ entry: data });
    }

    if (body.action === "createMeal") {
      const mealName = z.string().trim().min(1).max(100).parse(body.name);
      const items = z.array(z.object({ foodId: z.string().uuid(), servings: servingsSchema })).min(1).max(30).parse(body.items);
      const ids = [...new Set(items.map((item) => item.foodId))];
      const { data: foods } = await client.from("nutrition_foods").select("id").eq("profile_id", profileId).in("id", ids);
      if ((foods ?? []).length !== ids.length) return NextResponse.json({ error: "A meal item is unavailable." }, { status: 400 });
      const { data: meal, error: mealError } = await client.from("saved_meals").insert({ profile_id: profileId, name: mealName }).select().single();
      if (mealError || !meal) throw new Error(mealError?.message ?? "Could not save meal.");
      const { error: itemError } = await client.from("saved_meal_items").insert(items.map((item) => ({ meal_id: meal.id, food_id: item.foodId, servings: item.servings })));
      if (itemError) {
        await client.from("saved_meals").delete().eq("id", meal.id);
        throw new Error(itemError.message);
      }
      return NextResponse.json({ meal });
    }

    if (body.action === "logMeal") {
      const mealId = z.string().uuid().parse(body.mealId);
      const localDate = resolveLocalDate(body.localDate, profile.timezone);
      const { data: meal } = await client.from("saved_meals").select("*").eq("id", mealId).eq("profile_id", profileId).maybeSingle();
      if (!meal) return NextResponse.json({ error: "Meal not found." }, { status: 404 });
      const { data: items } = await client.from("saved_meal_items").select("*").eq("meal_id", mealId);
      const foodIds = (items ?? []).map((item: any) => item.food_id);
      const { data: foods } = foodIds.length ? await client.from("nutrition_foods").select("*").eq("profile_id", profileId).in("id", foodIds) : { data: [] };
      const byId = new Map((foods ?? []).map((food: any) => [food.id, food]));
      const entries = (items ?? []).flatMap((item: any) => {
        const food = byId.get(item.food_id);
        if (!food) return [];
        const totals = scaledFood(food, Number(item.servings));
        return [{ profile_id: profileId, local_date: localDate, food_id: food.id, meal_id: meal.id, food_name: food.name, meal_label: meal.name, servings: item.servings, serving_label: food.serving_description, calories: totals.calories, protein_grams: totals.protein, carb_grams: totals.carbs, fat_grams: totals.fat }];
      });
      if (!entries.length) return NextResponse.json({ error: "This meal has no available foods." }, { status: 400 });
      const { data, error } = await client.from("nutrition_entries").insert(entries).select();
      if (error) throw new Error(error.message);
      return NextResponse.json({ entries: data });
    }

    return NextResponse.json({ error: "Unknown nutrition action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof z.ZodError ? "Check the food details and try again." : error instanceof Error ? error.message : "Could not save nutrition.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await supabaseForRequest();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { client, session } = ctx;
  const body = await req.json().catch(() => null);
  const id = z.string().uuid().safeParse(body?.id);
  if (!id.success || (body?.kind !== "entry" && body?.kind !== "favorite" && body?.kind !== "meal")) return NextResponse.json({ error: "Invalid delete request." }, { status: 400 });
  const table = body.kind === "entry" ? "nutrition_entries" : body.kind === "favorite" ? "food_favorites" : "saved_meals";
  const column = body.kind === "favorite" ? "food_id" : "id";
  const { error } = await client.from(table).delete().eq(column, id.data).eq("profile_id", session.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
