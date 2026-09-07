import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/test/fakeSupabase";

let db: FakeSupabase;
const profileId = "11111111-1111-4111-8111-111111111111";
const foodId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const mealId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

vi.mock("@/lib/supabase/server", () => ({
  supabaseForRequest: async () => ({
    client: db,
    session: { id: profileId, role: "client", tier: "free", onboarded: true, timezone: "America/New_York" },
    profile: { id: profileId, timezone: "America/New_York" },
  }),
}));

function request(body: unknown) {
  return { json: async () => body } as any;
}

const food = {
  id: foodId,
  profile_id: profileId,
  source: "usda",
  external_id: "123",
  name: "Greek yogurt",
  brand: "Test Brand",
  serving_description: "1 cup",
  serving_quantity: 1,
  serving_unit: "cup",
  serving_grams: 200,
  calories: 130,
  protein_grams: 18,
  carb_grams: 8,
  fat_grams: 2,
};

beforeEach(() => {
  db = new FakeSupabase({
    nutrition_foods: [food],
    food_favorites: [],
    saved_meals: [{ id: mealId, profile_id: profileId, name: "Breakfast" }],
    saved_meal_items: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", meal_id: mealId, food_id: foodId, servings: 2 }],
    nutrition_entries: [],
  });
});

describe("nutrition API", () => {
  it("saves a USDA food into the client library", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({
      action: "saveFood",
      food: {
        source: "usda", externalId: "456", name: "Cottage cheese", brand: "Test Brand", servingDescription: "1/2 cup",
        servingQuantity: 0.5, servingUnit: "cup", servingGrams: 113, calories: 90, proteinGrams: 13, carbGrams: 5, fatGrams: 2,
      },
    }));

    expect(response.status).toBe(200);
    expect(db.tables.nutrition_foods).toHaveLength(2);
  });

  it("logs adjusted servings as a macro snapshot", async () => {
    const { POST } = await import("./route");
    const log = await POST(request({ action: "logFood", foodId, servings: 1.5, localDate: "2026-09-07" }));
    const logged = await log.json();

    expect(logged.entry).toMatchObject({ calories: 195, protein_grams: 27, carb_grams: 12, fat_grams: 3, servings: 1.5 });
  });

  it("creates a reusable meal and logs its component food snapshots", async () => {
    const { POST } = await import("./route");
    const saved = await POST(request({ action: "createMeal", name: "Second breakfast", items: [{ foodId, servings: 2 }] }));
    expect(saved.status).toBe(200);
    expect(db.tables.saved_meal_items).toHaveLength(2);

    const logged = await POST(request({ action: "logMeal", mealId, localDate: "2026-09-07" }));
    const body = await logged.json();

    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toMatchObject({ meal_label: "Breakfast", calories: 260, protein_grams: 36 });
  });

  it("does not favorite a food outside the client library", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ action: "favorite", foodId: "22222222-2222-4222-8222-222222222222" }));
    expect(response.status).toBe(404);
  });
});
