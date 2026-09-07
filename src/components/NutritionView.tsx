"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { entryTotals, scaledFood } from "@/lib/nutrition";
import type { FoodFavorite, NutritionEntry, NutritionFood, SavedMeal, SavedMealItem } from "@/lib/types";
import type { UsdaFoodResult } from "@/lib/usda";

type NutritionPayload = {
  foods: NutritionFood[];
  favorites: FoodFavorite[];
  meals: SavedMeal[];
  mealItems: SavedMealItem[];
  entries: NutritionEntry[];
};

function foodInput(food: UsdaFoodResult | NutritionFood) {
  const usda = "externalId" in food;
  return usda
    ? {
        source: "usda", externalId: food.externalId, name: food.name, brand: food.brand,
        servingDescription: food.servingDescription, servingQuantity: food.servingQuantity,
        servingUnit: food.servingUnit, servingGrams: food.servingGrams, calories: food.calories,
        proteinGrams: food.proteinGrams, carbGrams: food.carbGrams, fatGrams: food.fatGrams,
      }
    : {
        source: food.source, externalId: food.external_id, name: food.name, brand: food.brand,
        servingDescription: food.serving_description, servingQuantity: Number(food.serving_quantity),
        servingUnit: food.serving_unit, servingGrams: food.serving_grams == null ? null : Number(food.serving_grams),
        calories: Number(food.calories), proteinGrams: Number(food.protein_grams), carbGrams: Number(food.carb_grams), fatGrams: Number(food.fat_grams),
      };
}

function MacroLine({ calories, protein, carbs, fat }: { calories: number; protein: number; carbs: number; fat: number }) {
  return <span className="text-xs text-jcf-gray">{Math.round(calories)} cal · P {Math.round(protein)}g · C {Math.round(carbs)}g · F {Math.round(fat)}g</span>;
}

export function NutritionView({
  initial,
  localDate,
  targets,
}: {
  initial: NutritionPayload;
  localDate: string;
  targets: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null };
}) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UsdaFoodResult[]>([]);
  const [servings, setServings] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mealName, setMealName] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", serving: "1 serving" });

  const foodById = useMemo(() => new Map(data.foods.map((food) => [food.id, food])), [data.foods]);
  const favoriteIds = useMemo(() => new Set(data.favorites.map((favorite) => favorite.food_id)), [data.favorites]);
  const favorites = data.foods.filter((food) => favoriteIds.has(food.id));
  const totals = entryTotals(data.entries);

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, init);
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? "Something went wrong.");
    return payload;
  }

  async function refresh() {
    const payload = await request("/api/nutrition") as NutritionPayload;
    setData(payload);
  }

  function amount(key: string): number {
    const value = Number(servings[key] ?? "1");
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const payload = await request(`/api/usda/search?q=${encodeURIComponent(query.trim())}`);
      setResults(payload.foods ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Food search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function addFood(food: UsdaFoodResult | NutritionFood, servingKey: string) {
    setBusy(`add-${servingKey}`);
    setError(null);
    try {
      const saved = "id" in food
        ? food
        : (await request("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveFood", food: foodInput(food) }) })).food as NutritionFood;
      if (!foodById.has(saved.id)) setData((current) => ({ ...current, foods: [...current.foods, saved].sort((a, b) => a.name.localeCompare(b.name)) }));
      const payload = await request("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logFood", foodId: saved.id, servings: amount(servingKey), localDate }) });
      setData((current) => ({ ...current, entries: [payload.entry, ...current.entries] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add food.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleFavorite(food: NutritionFood) {
    setBusy(`favorite-${food.id}`);
    setError(null);
    try {
      if (favoriteIds.has(food.id)) {
        await request("/api/nutrition", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "favorite", id: food.id }) });
        setData((current) => ({ ...current, favorites: current.favorites.filter((favorite) => favorite.food_id !== food.id) }));
      } else {
        await request("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "favorite", foodId: food.id }) });
        setData((current) => ({ ...current, favorites: [...current.favorites, { profile_id: "", food_id: food.id, created_at: new Date().toISOString() }] }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update favorite.");
    } finally {
      setBusy(null);
    }
  }

  async function favoriteSearchFood(food: UsdaFoodResult) {
    setBusy(`favorite-usda-${food.externalId}`);
    setError(null);
    try {
      const saved = (await request("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveFood", food: foodInput(food) }) })).food as NutritionFood;
      await request("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "favorite", foodId: saved.id }) });
      setData((current) => ({
        ...current,
        foods: current.foods.some((item) => item.id === saved.id) ? current.foods : [...current.foods, saved].sort((a, b) => a.name.localeCompare(b.name)),
        favorites: current.favorites.some((favorite) => favorite.food_id === saved.id) ? current.favorites : [...current.favorites, { profile_id: "", food_id: saved.id, created_at: new Date().toISOString() }],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save favorite.");
    } finally {
      setBusy(null);
    }
  }

  async function saveMeal() {
    const grouped = new Map<string, number>();
    for (const entry of data.entries) if (entry.food_id) grouped.set(entry.food_id, (grouped.get(entry.food_id) ?? 0) + Number(entry.servings));
    if (!mealName.trim() || grouped.size === 0) return;
    setBusy("meal");
    setError(null);
    try {
      await request("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createMeal", name: mealName.trim(), items: [...grouped].map(([foodId, servings]) => ({ foodId, servings })) }) });
      setMealName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save meal.");
    } finally {
      setBusy(null);
    }
  }

  async function addMeal(meal: SavedMeal) {
    setBusy(`meal-${meal.id}`);
    setError(null);
    try {
      const payload = await request("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logMeal", mealId: meal.id, localDate }) });
      setData((current) => ({ ...current, entries: [...payload.entries, ...current.entries] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add meal.");
    } finally {
      setBusy(null);
    }
  }

  async function removeEntry(entry: NutritionEntry) {
    setBusy(`entry-${entry.id}`);
    try {
      await request("/api/nutrition", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "entry", id: entry.id }) });
      setData((current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entry.id) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove entry.");
    } finally {
      setBusy(null);
    }
  }

  async function saveManual(event: FormEvent) {
    event.preventDefault();
    setBusy("manual");
    setError(null);
    try {
      const food = (await request("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "saveFood", food: {
          source: "manual", name: manual.name, brand: null, servingDescription: manual.serving,
          servingQuantity: 1, servingUnit: "serving", servingGrams: null, calories: Number(manual.calories),
          proteinGrams: Number(manual.protein), carbGrams: Number(manual.carbs), fatGrams: Number(manual.fat),
        },
      }) })).food as NutritionFood;
      await request("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "favorite", foodId: food.id }) });
      setData((current) => ({ ...current, foods: [...current.foods, food].sort((a, b) => a.name.localeCompare(b.name)), favorites: [...current.favorites, { profile_id: "", food_id: food.id, created_at: new Date().toISOString() }] }));
      setManual({ name: "", calories: "", protein: "", carbs: "", fat: "", serving: "1 serving" });
      setManualOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save food.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <section className="bg-jcf-panel border border-white/10 rounded-sm p-4 mb-6">
        <p className="text-[10px] uppercase tracking-widest text-jcf-gray">Today&apos;s intake</p>
        <div className="flex items-baseline justify-between gap-3 mb-3"><span className="font-display text-4xl text-jcf-gold">{Math.round(totals.calories)}</span><span className="text-xs text-jcf-gray">of {targets.calories ?? "—"} calories</span></div>
        <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
          {[["Protein", totals.protein, targets.protein], ["Carbs", totals.carbs, targets.carbs], ["Fat", totals.fat, targets.fat]].map(([label, value, target]) => <div key={String(label)}><div className="font-display text-lg">{Math.round(Number(value))}g</div><div className="text-[10px] uppercase tracking-wider text-jcf-gray">{label} {target == null ? "" : `/ ${target}g`}</div></div>)}
        </div>
      </section>

      <form onSubmit={search} className="flex gap-2 mb-3">
        <label className="sr-only" htmlFor="food-search">Search USDA foods</label>
        <input id="food-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search foods or brands" className="flex-1 bg-jcf-panel border border-white/15 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-jcf-gold" />
        <Button type="submit" disabled={searching}>{searching ? "Searching" : "Search"}</Button>
      </form>
      <p className="text-[11px] text-jcf-gray mb-4">USDA FoodData Central · values use the listed serving. Adjust servings before adding.</p>
      {error && <p role="alert" className="text-jcf-danger text-sm mb-4">{error}</p>}

      {results.length > 0 && <section className="mb-7"><h2 className="text-[10px] uppercase tracking-[0.2em] text-jcf-gray mb-3">Search results</h2><div className="flex flex-col gap-2">{results.map((food) => { const key = `usda-${food.externalId}`; const currentServings = amount(key); const macros = { calories: food.calories * currentServings, protein: food.proteinGrams * currentServings, carbs: food.carbGrams * currentServings, fat: food.fatGrams * currentServings }; return <div key={food.externalId} className="bg-jcf-panel border border-white/10 rounded-sm p-3"><p className="text-sm text-white">{food.name}</p>{food.brand && <p className="text-xs text-jcf-gray">{food.brand}</p>}<p className="text-xs text-jcf-gray mt-1">{food.servingDescription}</p><MacroLine {...macros} /><div className="flex gap-2 mt-3"><input aria-label={`Servings of ${food.name}`} inputMode="decimal" value={servings[key] ?? "1"} onChange={(event) => setServings((current) => ({ ...current, [key]: event.target.value }))} className="w-20 bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm" /><button type="button" onClick={() => addFood(food, key)} disabled={busy === `add-${key}`} className="flex-1 border border-jcf-gold/50 text-jcf-gold rounded-sm text-xs uppercase tracking-wide hover:bg-jcf-gold/10">{busy === `add-${key}` ? "Adding..." : "Add to today"}</button><button type="button" onClick={() => favoriteSearchFood(food)} disabled={busy === `favorite-usda-${food.externalId}`} aria-label={`Save ${food.name} as a favorite`} className="border border-white/20 text-jcf-gold rounded-sm px-3">★</button></div></div>; })}</div></section>}

      <section className="mb-7"><div className="flex items-baseline justify-between mb-3"><h2 className="text-[10px] uppercase tracking-[0.2em] text-jcf-gray">Favorites</h2><button type="button" onClick={() => setManualOpen((open) => !open)} className="text-jcf-gold text-xs uppercase tracking-wide">{manualOpen ? "Close" : "+ Custom food"}</button></div>{manualOpen && <form onSubmit={saveManual} className="bg-jcf-panel border border-white/10 rounded-sm p-3 mb-3 grid grid-cols-2 gap-2"><input required value={manual.name} onChange={(e) => setManual((v) => ({ ...v, name: e.target.value }))} placeholder="Food name" className="col-span-2 bg-jcf-black border border-white/15 rounded-sm px-2 py-2 text-sm" /><input required value={manual.serving} onChange={(e) => setManual((v) => ({ ...v, serving: e.target.value }))} placeholder="Serving (e.g. 1 scoop)" className="col-span-2 bg-jcf-black border border-white/15 rounded-sm px-2 py-2 text-sm" />{(["calories", "protein", "carbs", "fat"] as const).map((key) => <input key={key} required inputMode="decimal" value={manual[key]} onChange={(e) => setManual((v) => ({ ...v, [key]: e.target.value }))} placeholder={key === "calories" ? "Calories" : `${key} grams`} className="bg-jcf-black border border-white/15 rounded-sm px-2 py-2 text-sm" />)}<Button type="submit" disabled={busy === "manual"} className="col-span-2">Save custom food</Button></form>}{favorites.length === 0 ? <p className="text-xs text-jcf-gray">Save a food, then use the star to keep it here.</p> : <div className="flex flex-col gap-2">{favorites.map((food) => { const key = `food-${food.id}`; const macros = scaledFood(food, amount(key)); return <div key={food.id} className="bg-jcf-panel border border-white/10 rounded-sm p-3"><div className="flex justify-between gap-3"><div><p className="text-sm">{food.name}</p><MacroLine {...macros} /></div><button type="button" onClick={() => toggleFavorite(food)} disabled={busy === `favorite-${food.id}`} aria-label={`Remove ${food.name} from favorites`} className="text-jcf-gold">★</button></div><div className="flex gap-2 mt-3"><input aria-label={`Servings of ${food.name}`} inputMode="decimal" value={servings[key] ?? "1"} onChange={(event) => setServings((current) => ({ ...current, [key]: event.target.value }))} className="w-20 bg-jcf-black border border-white/15 rounded-sm px-2 py-1.5 text-sm" /><button type="button" onClick={() => addFood(food, key)} className="flex-1 border border-jcf-gold/50 text-jcf-gold rounded-sm text-xs uppercase tracking-wide">Add to today</button></div></div>; })}</div>}</section>

      <section className="mb-7"><h2 className="text-[10px] uppercase tracking-[0.2em] text-jcf-gray mb-3">Reusable meals</h2>{data.meals.length > 0 && <div className="flex flex-col gap-2 mb-3">{data.meals.map((meal) => { const items = data.mealItems.filter((item) => item.meal_id === meal.id); const mealTotals = items.reduce((total, item) => { const food = foodById.get(item.food_id); const macros = food ? scaledFood(food, Number(item.servings)) : { calories: 0, protein: 0, carbs: 0, fat: 0 }; return { calories: total.calories + macros.calories, protein: total.protein + macros.protein, carbs: total.carbs + macros.carbs, fat: total.fat + macros.fat }; }, { calories: 0, protein: 0, carbs: 0, fat: 0 }); return <div key={meal.id} className="bg-jcf-panel border border-white/10 rounded-sm p-3 flex items-center justify-between gap-3"><div><p className="text-sm">{meal.name}</p><MacroLine {...mealTotals} /></div><button type="button" onClick={() => addMeal(meal)} disabled={busy === `meal-${meal.id}`} className="shrink-0 border border-jcf-gold/50 text-jcf-gold rounded-sm px-3 py-2 text-xs uppercase tracking-wide">{busy === `meal-${meal.id}` ? "Adding" : "Add meal"}</button></div>; })}</div>}<div className="flex gap-2"><input value={mealName} onChange={(event) => setMealName(event.target.value)} placeholder="Save today&apos;s foods as…" className="flex-1 bg-jcf-panel border border-white/15 rounded-sm px-3 py-2 text-sm" /><button type="button" onClick={saveMeal} disabled={busy === "meal" || !mealName.trim() || !data.entries.some((entry) => entry.food_id)} className="border border-jcf-gold/50 text-jcf-gold rounded-sm px-3 text-xs uppercase tracking-wide">Save meal</button></div></section>

      <section><h2 className="text-[10px] uppercase tracking-[0.2em] text-jcf-gray mb-3">Logged today</h2>{data.entries.length === 0 ? <p className="text-xs text-jcf-gray">Search a food or add a favorite to start your day.</p> : <div className="flex flex-col gap-2">{data.entries.map((entry) => <div key={entry.id} className="bg-jcf-panel border border-white/10 rounded-sm px-3 py-2 flex items-center justify-between gap-3"><div><p className="text-sm">{entry.food_name}{entry.meal_label && <span className="text-jcf-gray"> · {entry.meal_label}</span>}</p><MacroLine calories={Number(entry.calories)} protein={Number(entry.protein_grams)} carbs={Number(entry.carb_grams)} fat={Number(entry.fat_grams)} /></div><button type="button" onClick={() => removeEntry(entry)} disabled={busy === `entry-${entry.id}`} className="text-jcf-danger text-xs uppercase">Remove</button></div>)}</div>}</section>
    </div>
  );
}
