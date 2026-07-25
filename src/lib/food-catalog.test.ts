import { describe, it, expect } from "vitest";
import { BUILT_IN_FOODS, FOOD_CATEGORIES, mergeCatalog } from "./food-catalog";
import { normalizeFoodName } from "./food-normalize";
import { buildFoodSearchIndex, searchFoods } from "./food-search";
import { ALL_UNITS } from "./domain";
import type { Food } from "./domain";

const index = buildFoodSearchIndex(BUILT_IN_FOODS);
const names = (foods: Food[]) => foods.map((f) => f.name);

describe("catalog integrity", () => {
  it("has a substantial number of items", () => {
    expect(BUILT_IN_FOODS.length).toBeGreaterThanOrEqual(300);
  });

  it("has no blank display name and no blank normalized name", () => {
    for (const food of BUILT_IN_FOODS) {
      expect(food.name.trim()).not.toBe("");
      expect(food.name).toBe(food.name.trim());
      expect(normalizeFoodName(food.name)).not.toBe("");
    }
  });

  it("has no duplicate normalized names", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const food of BUILT_IN_FOODS) {
      const key = normalizeFoodName(food.name);
      const previous = seen.get(key);
      if (previous) duplicates.push(`${previous} / ${food.name} → "${key}"`);
      else seen.set(key, food.name);
    }
    expect(duplicates).toEqual([]);
  });

  it("has unique ids that mark every item as built-in", () => {
    const ids = BUILT_IN_FOODS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    // `f_` is what distinguishes a catalog food from a user-created UUID
    // (isCustomFoodId in sync/migrate-local.ts).
    for (const id of ids) expect(id.startsWith("f_")).toBe(true);
  });

  it("uses only valid units, and a default unit that is offered", () => {
    for (const food of BUILT_IN_FOODS) {
      expect(food.suggestedUnits, food.name).toBeDefined();
      expect(food.suggestedUnits!.length, food.name).toBeGreaterThan(0);
      for (const unit of food.suggestedUnits!) {
        expect(ALL_UNITS, `${food.name}: ${unit}`).toContain(unit);
      }
      expect(food.defaultUnit, food.name).toBeDefined();
      expect(food.suggestedUnits, food.name).toContain(food.defaultUnit);
    }
  });

  it("assigns food-specific units rather than one set for everything", () => {
    const shapes = new Set(BUILT_IN_FOODS.map((f) => f.suggestedUnits!.join("|")));
    expect(shapes.size).toBeGreaterThanOrEqual(15);
  });

  it("uses only declared categories, and populates all of them", () => {
    const used = new Set<string>();
    for (const food of BUILT_IN_FOODS) {
      expect(food.category, food.name).toBeDefined();
      expect(FOOD_CATEGORIES as readonly string[], food.name).toContain(food.category!);
      used.add(food.category!);
    }
    expect(used.size).toBe(FOOD_CATEGORIES.length);
  });

  it("carries no nutrition, scoring, favorite or usage data", () => {
    const allowed = new Set([
      "id",
      "name",
      "category",
      "defaultUnit",
      "suggestedUnits",
      "kind",
      "isActive",
    ]);
    for (const food of BUILT_IN_FOODS) {
      for (const key of Object.keys(food)) {
        expect(allowed, `${food.name} has unexpected field "${key}"`).toContain(key);
      }
    }
  });

  it("has no placeholder or numbered filler items", () => {
    for (const food of BUILT_IN_FOODS) {
      expect(food.name, food.name).not.toMatch(/\d/);
      expect(food.name.toLowerCase(), food.name).not.toMatch(
        /test|todo|placeholder|sample|demo|mock|foo|bar|lorem|בדיקה|דוגמה/,
      );
      expect(food.name.length, food.name).toBeGreaterThan(1);
    }
  });

  it("marks exactly one coffee-kind food, the one the coffee editor uses", () => {
    const coffee = BUILT_IN_FOODS.filter((f) => f.kind === "coffee");
    expect(coffee).toHaveLength(1);
    expect(coffee[0].id).toBe("f_coffee");
  });

  it("covers each required category with a practical number of items", () => {
    const counts = new Map<string, number>();
    for (const food of BUILT_IN_FOODS) {
      counts.set(food.category!, (counts.get(food.category!) ?? 0) + 1);
    }
    for (const category of FOOD_CATEGORIES) {
      expect(counts.get(category) ?? 0, category).toBeGreaterThanOrEqual(7);
    }
  });
});

describe("catalog search", () => {
  const findByName = (name: string) => BUILT_IN_FOODS.find((f) => f.name === name);

  it("resolves every query from the pilot checklist", () => {
    const cases: Array<{ query: string; expect: string }> = [
      { query: "מלפפון", expect: "מלפפון" },
      { query: "עגבניה", expect: "עגבנייה" },
      { query: "עגבנייה", expect: "עגבנייה" },
      { query: "גבינה צהובה", expect: "גבינה צהובה" },
      { query: "שניצל", expect: "שניצל עוף" },
      { query: "אורז", expect: "אורז לבן" },
      { query: "חזה עוף", expect: "חזה עוף" },
      { query: "סלט", expect: "סלט ירקות" },
      { query: "מים", expect: "מים" },
      { query: "קפה", expect: "קפה" },
      { query: "קוטג", expect: "קוטג׳" },
      { query: "פיתה", expect: "פיתה" },
      { query: "טחינה", expect: "טחינה מוכנה" },
    ];
    for (const { query, expect: expected } of cases) {
      const results = searchFoods(index, query);
      expect(results.length, query).toBeGreaterThan(0);
      expect(names(results), query).toContain(expected);
    }
  });

  it("ranks an exact name first so a one-tap pick hits the obvious food", () => {
    expect(searchFoods(index, "תפוח")[0].name).toBe("תפוח");
    expect(searchFoods(index, "מים")[0].name).toBe("מים");
    expect(searchFoods(index, "קפה")[0].name).toBe("קפה");
    expect(searchFoods(index, "חלב")[0].name).toBe("חלב");
  });

  it("finds every schnitzel and every coffee variant", () => {
    expect(searchFoods(index, "שניצל").length).toBeGreaterThanOrEqual(3);
    const coffees = names(searchFoods(index, "קפה"));
    expect(coffees).toEqual(expect.arrayContaining(["קפה", "קפה שחור", "קפה נמס", "קפה הפוך"]));
  });

  it("matches apostrophe-free and vocalised typing", () => {
    expect(names(searchFoods(index, "קוטג'"))).toContain("קוטג׳");
    expect(names(searchFoods(index, "צ'יפס"))).toContain("צ׳יפס");
    expect(names(searchFoods(index, "לֶחֶם מָלֵא"))).toContain("לחם מלא");
  });

  it("matches a word inside a multi-word name", () => {
    expect(names(searchFoods(index, "ירקות"))).toContain("סלט ירקות");
    expect(names(searchFoods(index, "עוף"))).toContain("מרק עוף");
  });

  it("caps results and returns nothing for an empty query", () => {
    expect(searchFoods(index, "").length).toBe(0);
    expect(searchFoods(index, "   ").length).toBe(0);
    // A very common letter pair matches far more than the cap.
    expect(searchFoods(index, "ה", 20).length).toBeLessThanOrEqual(20);
    expect(searchFoods(index, "סל", 5).length).toBeLessThanOrEqual(5);
  });

  it("returns no results for a food that is not in the catalog", () => {
    expect(searchFoods(index, "קרמבולה סגולה")).toEqual([]);
  });

  it("keeps the example unit sets from the product checklist", () => {
    expect(findByName("מלפפון")!.suggestedUnits).toEqual(["יחידה", "חצי יחידה", "גרם"]);
    expect(findByName("עגבנייה")!.suggestedUnits).toEqual(["יחידה", "חצי יחידה", "גרם"]);
    expect(findByName("גבינה צהובה")!.suggestedUnits).toEqual(["פרוסה", "גרם"]);
    expect(findByName("שניצל עוף")!.suggestedUnits).toEqual(["יחידה", "מנה", "גרם"]);
    expect(findByName("מים")!.suggestedUnits).toEqual(["מ״ל", "כוס", "ליטר"]);
    expect(findByName("קפה")!.defaultUnit).toBe("כוס");
    expect(findByName("אורז לבן")!.suggestedUnits).toEqual(["כוס", "כף", "מנה", "גרם"]);
  });
});

describe("mergeCatalog", () => {
  const builtIn = BUILT_IN_FOODS.slice(0, 5);
  const cucumber = BUILT_IN_FOODS.find((f) => f.name === "מלפפון")!;

  it("returns the built-in catalog when the household has no rows yet", () => {
    expect(mergeCatalog(builtIn, [])).toEqual(builtIn);
  });

  it("lets a remote row supersede a built-in food while keeping the app id", () => {
    const remote: Food[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "מלפפון",
        category: "ירקות ועשבי תיבול",
        defaultUnit: "גרם",
        isActive: true,
      },
    ];
    const merged = mergeCatalog([cucumber], remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(cucumber.id);
    expect(merged[0].defaultUnit).toBe("גרם");
    // The built-in unit set survives: the schema has no allowed_units column.
    expect(merged[0].suggestedUnits).toEqual(cucumber.suggestedUnits);
  });

  it("matches a remote row spelled differently but normalizing the same", () => {
    const remote: Food[] = [{ id: "uuid-1", name: "  מלפפון  ", isActive: true }];
    expect(mergeCatalog([cucumber], remote)).toHaveLength(1);
  });

  it("hides a built-in food that the household archived remotely", () => {
    const remote: Food[] = [{ id: "uuid-2", name: "מלפפון", isActive: false }];
    expect(mergeCatalog([cucumber], remote)).toEqual([]);
  });

  it("adds custom foods and drops archived ones", () => {
    const remote: Food[] = [
      { id: "uuid-3", name: "שייק בננה של אמא", isActive: true },
      { id: "uuid-4", name: "מאכל שהוסר", isActive: false },
    ];
    const merged = mergeCatalog([cucumber], remote);
    expect(names(merged)).toEqual(["שייק בננה של אמא", "מלפפון"]);
  });

  it("never produces duplicate normalized names", () => {
    const remote: Food[] = BUILT_IN_FOODS.slice(0, 40).map((f, i) => ({
      id: `uuid-${i}`,
      name: f.name,
      isActive: true,
    }));
    const merged = mergeCatalog(BUILT_IN_FOODS, remote);
    const keys = merged.map((f) => normalizeFoodName(f.name));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
