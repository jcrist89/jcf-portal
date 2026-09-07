import { describe, expect, it } from "vitest";
import { normalizeUsdaFood } from "./usda";

describe("normalizeUsdaFood", () => {
  it("keeps labelled branded nutrients at their supplied serving size", () => {
    const food = normalizeUsdaFood({
      fdcId: 1, dataType: "Branded", description: "Protein yogurt", servingSize: 170, servingSizeUnit: "g",
      householdServingFullText: "1 container", foodNutrients: [
        { nutrientName: "Energy", value: 150 }, { nutrientName: "Protein", value: 20 },
        { nutrientName: "Carbohydrate, by difference", value: 8 }, { nutrientName: "Total lipid (fat)", value: 2 },
      ],
    });
    expect(food).toMatchObject({ servingDescription: "1 container", calories: 150, proteinGrams: 20, carbGrams: 8, fatGrams: 2 });
  });

  it("uses a clear 100g serving for foundation foods", () => {
    const food = normalizeUsdaFood({
      fdcId: 2, dataType: "Foundation", description: "Apple", foodNutrients: [{ nutrientName: "Energy", value: 52 }],
    });
    expect(food).toMatchObject({ servingDescription: "100 g", servingQuantity: 100, servingUnit: "g", calories: 52 });
  });
});
