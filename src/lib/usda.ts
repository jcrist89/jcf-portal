export interface UsdaFoodResult {
  externalId: string;
  name: string;
  brand: string | null;
  servingDescription: string;
  servingQuantity: number;
  servingUnit: string;
  servingGrams: number | null;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

function nutrientValue(food: any, names: string[]): number {
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const match = nutrients.find((nutrient: any) => names.includes(nutrient.nutrientName));
  return numberOrZero(match?.value);
}

/** Normalizes USDA search results to one practical serving for the client UI. */
export function normalizeUsdaFood(food: any): UsdaFoodResult {
  // Branded search nutrients are supplied per labelled serving. Foundation and survey
  // foods are represented as 100g because they do not consistently carry a serving.
  const branded = food.dataType === "Branded";
  const servingQuantity = branded ? numberOrZero(food.servingSize) || 1 : 100;
  const servingUnit = branded && typeof food.servingSizeUnit === "string" ? food.servingSizeUnit : "g";
  const servingGrams = /g/i.test(servingUnit) ? servingQuantity : null;
  const perHundredCalories = nutrientValue(food, ["Energy"]);
  const perHundredProtein = nutrientValue(food, ["Protein"]);
  const perHundredCarbs = nutrientValue(food, ["Carbohydrate, by difference", "Carbohydrate"]);
  const perHundredFat = nutrientValue(food, ["Total lipid (fat)", "Total fat (NLEA)"]);

  return {
    externalId: String(food.fdcId),
    name: String(food.description ?? "USDA food"),
    brand: typeof food.brandOwner === "string" ? food.brandOwner : typeof food.brandName === "string" ? food.brandName : null,
    servingDescription: branded ? food.householdServingFullText || `${servingQuantity} ${servingUnit}` : "100 g",
    servingQuantity,
    servingUnit,
    servingGrams,
    calories: Math.round(perHundredCalories),
    proteinGrams: Math.round(perHundredProtein * 10) / 10,
    carbGrams: Math.round(perHundredCarbs * 10) / 10,
    fatGrams: Math.round(perHundredFat * 10) / 10,
  };
}

export async function searchUsdaFoods(query: string, apiKey: string): Promise<UsdaFoodResult[]> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, pageSize: 12, dataType: ["Branded", "Foundation", "Survey (FNDDS)"] }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`USDA search failed (${response.status})`);
  const payload = await response.json();
  return (Array.isArray(payload.foods) ? payload.foods : []).map(normalizeUsdaFood);
}
