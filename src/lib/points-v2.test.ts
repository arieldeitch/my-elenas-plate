/**
 * Points model v2-il (DEC-034) — scoring, hierarchy, portions, subjective
 * multipliers, category completeness, and the personalised daily budget.
 */
import { describe, it, expect } from "vitest";
import type { Food, FoodEntry } from "./domain";
import { ALL_UNITS } from "./domain";
import { FOOD_CATALOG, FOOD_CATEGORIES } from "./food-catalog";
import {
  ageFromBirthDate,
  calculatePersonalizedPointsBudget,
  calculatePointsV1,
  calculatePointsV2,
  latestWeightKg,
  mifflinStJeorBmr,
  pointsForDay,
  pointsForEntry,
  portionPointsForFood,
  portionsForEntry,
  resolvePointsBudget,
  scoreEntry,
  POINTS_MODEL_V1,
  POINTS_MODEL_V2,
  POINTS_MODEL_VERSION,
} from "./points";
import {
  BUDGET_V2,
  CATEGORY_PORTION_POINTS_V2,
  SUBJECTIVE_LABEL,
  SUBJECTIVE_MULTIPLIER_V2,
  UNIT_FAMILY,
} from "./points-config";

const food = (category?: string, extra: Partial<Food> = {}): Food => ({
  id: "f_x",
  name: "x",
  category,
  defaultUnit: "יחידה",
  ...extra,
});
const measured = (
  amount: number,
  unit: FoodEntry["unit"],
): Pick<FoodEntry, "mode" | "amount" | "unit"> => ({
  mode: "measured",
  amount,
  unit,
});
const subjective = (level: FoodEntry["subjective"]): Pick<FoodEntry, "mode" | "subjective"> => ({
  mode: "subjective",
  subjective: level,
});

describe("vegetables are free at every quantity (product rule)", () => {
  const veg = food("ירקות ועשבי תיבול", { defaultUnit: "גרם" });
  it.each([
    ["100 g", measured(100, "גרם")],
    ["500 g", measured(500, "גרם")],
    ["2 kg", measured(2, "ק״ג")],
    ["3 units", measured(3, "יחידה")],
    ["2 bowls", measured(2, "קערה")],
    ["יותר מדי", subjective("הרבה")],
    ["מוגזם", subjective("מוגזם")],
  ])("%s → 0", (_label, q) => {
    expect(calculatePointsV2(q, veg)).toBe(0);
  });
  it("every real vegetable in the catalog is 0 even at 1 kg", () => {
    const vegs = FOOD_CATALOG.filter((f) => f.category === "ירקות ועשבי תיבול");
    expect(vegs.length).toBeGreaterThan(10);
    for (const v of vegs) expect(calculatePointsV2(measured(1, "ק״ג"), v)).toBe(0);
  });
});

describe("fruit is a low POSITIVE value, never free", () => {
  const apple = food("פירות");
  it("1 unit ≈ 1 point; scales with units", () => {
    expect(calculatePointsV2(measured(1, "יחידה"), apple)).toBe(1);
    expect(calculatePointsV2(measured(2, "יחידה"), apple)).toBe(2);
    expect(calculatePointsV2(measured(1, "חצי יחידה"), apple)).toBe(0.5);
  });
  it("scales with grams: 150 g ≈ 1.5", () => {
    expect(calculatePointsV2(measured(150, "גרם"), apple)).toBe(1.5);
    expect(calculatePointsV2(measured(300, "גרם"), apple)).toBe(3);
    expect(calculatePointsV2(measured(50, "גרם"), apple)).toBe(0.5);
  });
  it("scales with the subjective level", () => {
    expect(calculatePointsV2(subjective("מעט"), apple)).toBe(0.5);
    expect(calculatePointsV2(subjective("במידה"), apple)).toBe(1);
    expect(calculatePointsV2(subjective("הרבה"), apple)).toBe(1.5);
    expect(calculatePointsV2(subjective("מוגזם"), apple)).toBe(2);
  });
  it("every real fruit in the catalog is > 0 for one default unit", () => {
    const fruits = FOOD_CATALOG.filter((f) => f.category === "פירות");
    expect(fruits.length).toBeGreaterThan(10);
    for (const f of fruits) {
      expect(calculatePointsV2(measured(1, f.defaultUnit), f)).toBeGreaterThan(0);
    }
  });
  it("an explicit calibrated value overrides the generic fruit fallback", () => {
    const banana = food("פירות", { pointsPerPortion: 2 });
    expect(portionPointsForFood(banana).basis).toBe("calibrated");
    expect(calculatePointsV2(measured(1, "יחידה"), banana)).toBe(2);
  });
});

describe("obvious vegetable dishes are calibrated, not charged as generic dishes", () => {
  it("plain vegetable salads are 0 at any quantity; light vegetable soups are low", () => {
    const byId = new Map(FOOD_CATALOG.map((f) => [f.id, f]));
    for (const id of ["f_veg_salad", "f_israeli_salad", "f_lettuce_salad", "f_cabbage_salad"]) {
      expect(portionPointsForFood(byId.get(id)!).basis).toBe("calibrated");
      expect(calculatePointsV2(measured(3, "קערה"), byId.get(id)!)).toBe(0);
      expect(calculatePointsV2(subjective("מוגזם"), byId.get(id)!)).toBe(0);
    }
    expect(calculatePointsV2(measured(1, "קערה"), byId.get("f_veg_soup")!)).toBe(1.5);
    expect(calculatePointsV2(measured(1, "קערה"), byId.get("f_greek_salad")!)).toBe(3);
    // Generic dishes keep the category value.
    expect(portionPointsForFood(byId.get("f_lasagna")!)).toEqual({ points: 5, basis: "category" });
  });
});

describe("cloud catalog merge keeps the calibration (production path)", () => {
  it("a seeded cloud row of the same food does not drop pointsPerPortion", async () => {
    const { mergeCatalog } = await import("./food-catalog");
    const remote: Food = {
      id: "cloud-1",
      name: "סלט ירקות",
      category: "מנות ותבשילים",
      defaultUnit: "קערה",
    };
    const merged = mergeCatalog(FOOD_CATALOG, [remote]);
    const salad = merged.find((f) => f.name === "סלט ירקות")!;
    expect(salad.id).toBe("f_veg_salad");
    expect(salad.pointsPerPortion).toBe(0);
    expect(calculatePointsV2(measured(2, "קערה"), salad)).toBe(0);
  });
});

describe("calculation hierarchy", () => {
  it("calibrated > nutrition > category > unknown; coffee and vegetables are zero", () => {
    expect(portionPointsForFood(food("קטניות", { pointsPerPortion: 1 })).basis).toBe("calibrated");
    expect(
      portionPointsForFood(
        food("קטניות", {
          nutrition: { calories: 165, proteinG: 31, servingAmount: 100, servingUnit: "גרם" },
        }),
      ).basis,
    ).toBe("nutrition");
    expect(portionPointsForFood(food("קטניות")).basis).toBe("category");
    expect(portionPointsForFood(food(undefined)).basis).toBe("unknown");
    expect(portionPointsForFood(food("ירקות ועשבי תיבול", { pointsPerPortion: 5 })).basis).toBe(
      "zero",
    );
    expect(portionPointsForFood(food("משקאות", { kind: "coffee" })).points).toBe(0);
  });
  it("nutrition-based score: real facts are normalised to one standard portion and stay non-negative", () => {
    const chicken = food("עוף ובשר", {
      nutrition: {
        calories: 165,
        proteinG: 31,
        saturatedFatG: 1,
        servingAmount: 100,
        servingUnit: "גרם",
      },
    });
    const kale = food("פירות", {
      nutrition: { calories: 30, fiberG: 9, proteinG: 3, servingAmount: 100, servingUnit: "גרם" },
    });
    expect(portionPointsForFood(chicken).points).toBeGreaterThan(1);
    expect(portionPointsForFood(chicken).points).toBeLessThan(4);
    expect(portionPointsForFood(kale).points).toBe(0); // negative clamps to 0
  });
});

describe("category fallback covers every real catalog category deterministically", () => {
  it("every FOOD_CATEGORIES entry has a value; vegetables lowest, sweets highest", () => {
    for (const c of FOOD_CATEGORIES) expect(typeof CATEGORY_PORTION_POINTS_V2[c]).toBe("number");
    expect(Object.keys(CATEGORY_PORTION_POINTS_V2).sort()).toEqual([...FOOD_CATEGORIES].sort());
    const v = CATEGORY_PORTION_POINTS_V2;
    expect(v["ירקות ועשבי תיבול"]).toBe(0);
    expect(v["פירות"]).toBeGreaterThan(0);
    expect(v["פירות"]).toBeLessThanOrEqual(v["דגים"]);
    expect(v["דגים"]).toBeLessThanOrEqual(v["מוצרי חלב ותחליפים"]);
    expect(v["מוצרי חלב ותחליפים"]).toBeLessThanOrEqual(v["לחם ומאפים"]);
    expect(v["לחם ומאפים"]).toBeLessThanOrEqual(v["אגוזים, גרעינים וממרחים"]);
    expect(v["אגוזים, גרעינים וממרחים"]).toBeLessThanOrEqual(v["חטיפים ומתוקים"]);
    expect(Math.max(...Object.values(v))).toBe(v["חטיפים ומתוקים"]);
  });
  it("no catalog food falls into the 'unknown' basis", () => {
    for (const f of FOOD_CATALOG) {
      expect(["zero", "category", "calibrated", "nutrition"]).toContain(
        portionPointsForFood(f).basis,
      );
    }
  });
});

describe("measured units: weight/volume scale, count units are portions", () => {
  it("every unit has a family and a finite portion factor; 1 g is never a full portion", () => {
    for (const u of ALL_UNITS) {
      expect(["weight", "volume", "count"]).toContain(UNIT_FAMILY[u]);
      expect(Number.isFinite(portionsForEntry(measured(1, u)))).toBe(true);
    }
    expect(portionsForEntry(measured(1, "גרם"))).toBe(0.01);
    expect(portionsForEntry(measured(1, "מ״ל"))).toBe(0.004);
    expect(portionsForEntry(measured(100, "גרם"))).toBe(1);
    expect(portionsForEntry(measured(1, "ק״ג"))).toBe(10);
    expect(portionsForEntry(measured(250, "מ״ל"))).toBe(1);
    expect(portionsForEntry(measured(1, "ליטר"))).toBe(4);
  });
  it("count units: unit 1, half 0.5, tablespoon 0.25, teaspoon 0.1, cup 1, mug 1.25, slice 1, bowl 1.5, serving 1", () => {
    expect(portionsForEntry(measured(1, "יחידה"))).toBe(1);
    expect(portionsForEntry(measured(1, "חצי יחידה"))).toBe(0.5);
    expect(portionsForEntry(measured(1, "כף"))).toBe(0.25);
    expect(portionsForEntry(measured(1, "כפית"))).toBe(0.1);
    expect(portionsForEntry(measured(1, "כוס"))).toBe(1);
    expect(portionsForEntry(measured(1, "ספל"))).toBe(1.25);
    expect(portionsForEntry(measured(1, "פרוסה"))).toBe(1);
    expect(portionsForEntry(measured(1, "קערה"))).toBe(1.5);
    expect(portionsForEntry(measured(1, "מנה"))).toBe(1);
  });
  it("a non-zero food never rounds down to 0 (1 g of bread = 0.5, not 0); zero/negative amounts are 0", () => {
    expect(calculatePointsV2(measured(1, "גרם"), food("לחם ומאפים"))).toBe(0.5);
    expect(calculatePointsV2(measured(0, "גרם"), food("לחם ומאפים"))).toBe(0);
    expect(calculatePointsV2(measured(-3, "יחידה"), food("לחם ומאפים"))).toBe(0);
  });
});

describe("subjective multipliers are centralised and labelled", () => {
  it("0.5 / 1 / 1.5 / 2 and the visible label of הרבה is יותר מדי", () => {
    expect(SUBJECTIVE_MULTIPLIER_V2).toEqual({ מעט: 0.5, במידה: 1, הרבה: 1.5, מוגזם: 2 });
    expect(SUBJECTIVE_LABEL["הרבה"]).toBe("יותר מדי");
    const dish = food("מנות ותבשילים");
    expect(calculatePointsV2(subjective("מעט"), dish)).toBe(2.5);
    expect(calculatePointsV2(subjective("מוגזם"), dish)).toBe(10);
  });
});

describe("snapshots: persisted wins; the v2-il model is history only (DEC-036)", () => {
  const bread = food("לחם ומאפים");
  it("scoreEntry no longer uses the v2-il model: a food without a reference row is saved unscored", () => {
    expect(POINTS_MODEL_VERSION).toBe(POINTS_MODEL_V2); // legacy constant, explains old snapshots
    const e = scoreEntry({ mode: "measured", amount: 2, unit: "פרוסה" }, bread);
    expect(e).toMatchObject({ pointsValue: null, pointsBasis: "unscored:no_reference" });
    expect(calculatePointsV2({ mode: "measured", amount: 2, unit: "פרוסה" }, bread)).toBe(6); // what v2 WOULD have said
  });
  it("a persisted v1 snapshot is displayed as saved even where v2 would differ", () => {
    const fruitV1: FoodEntry = {
      id: "e1",
      foodId: "f_apple",
      foodName: "תפוח",
      mode: "measured",
      amount: 1,
      unit: "יחידה",
      pointsValue: calculatePointsV1(measured(1, "יחידה"), food("פירות")),
      pointsModelVersion: POINTS_MODEL_V1,
    };
    expect(fruitV1.pointsValue).toBe(0); // v1 treated fruit as free
    expect(pointsForEntry(fruitV1, food("פירות"))).toBe(0); // still 0 on display
    expect(calculatePointsV2(fruitV1, food("פירות"))).toBe(1); // v2 would say 1
  });
  it("an entry without any snapshot is unscored on display — never estimated (DEC-036)", () => {
    const old: FoodEntry = {
      id: "e0",
      foodId: "f",
      foodName: "x",
      mode: "measured",
      amount: 1,
      unit: "פרוסה",
    };
    expect(pointsForEntry(old, bread)).toBeNull();
    expect(old.pointsValue).toBeUndefined();
  });
  it("pointsForDay sums per-entry values with the snapshot precedence", () => {
    const day = {
      steps: undefined,
      meals: {
        lunch: {
          slot: "lunch",
          status: "logged",
          entries: [
            {
              id: "a",
              foodId: "f_x",
              foodName: "x",
              mode: "measured",
              amount: 1,
              unit: "פרוסה",
              pointsValue: 1,
              pointsModelVersion: "v1",
            },
            { id: "b", foodId: "f_x", foodName: "x", mode: "measured", amount: 1, unit: "פרוסה" },
          ],
        },
      },
    } as unknown as Parameters<typeof pointsForDay>[0];
    expect(pointsForDay(day, [bread])).toBe(1); // the snapshot only; the unscored entry adds nothing
  });
});

describe("personalised daily budget (Mifflin-St Jeor backbone, provisional mapping)", () => {
  const base = {
    sexAtBirth: "female" as const,
    age: 40,
    heightCm: 165,
    weightKg: 70,
    goalMode: "lose" as const,
  };
  it("uses the public Mifflin-St Jeor equation", () => {
    expect(mifflinStJeorBmr({ sexAtBirth: "male", age: 40, heightCm: 180, weightKg: 80 })).toBe(
      10 * 80 + 6.25 * 180 - 5 * 40 + 5,
    );
    expect(mifflinStJeorBmr({ sexAtBirth: "female", age: 40, heightCm: 165, weightKg: 70 })).toBe(
      10 * 70 + 6.25 * 165 - 5 * 40 - 161,
    );
  });
  it("reference person maps to the reference points; scaled linearly and rounded to the step", () => {
    // BMR 1370.25 → 23 * 1370.25/1400 = 22.5 → rounds to 23 (step 1)
    expect(calculatePersonalizedPointsBudget(base)).toBe(23);
  });
  it("sex, age, height and weight each move the budget in the expected direction", () => {
    const b = calculatePersonalizedPointsBudget(base);
    expect(calculatePersonalizedPointsBudget({ ...base, sexAtBirth: "male" })).toBeGreaterThan(b);
    expect(calculatePersonalizedPointsBudget({ ...base, age: 65 })).toBeLessThan(b);
    expect(calculatePersonalizedPointsBudget({ ...base, heightCm: 185 })).toBeGreaterThan(b);
    expect(calculatePersonalizedPointsBudget({ ...base, weightKg: 95 })).toBeGreaterThan(b);
  });
  it("maintenance applies the documented uplift", () => {
    const loss = calculatePersonalizedPointsBudget(base);
    const maintain = calculatePersonalizedPointsBudget({ ...base, goalMode: "maintain" });
    // uplift applies to the clamped (unrounded) loss budget, then rounds once
    const raw =
      (BUDGET_V2.REFERENCE_DAILY_POINTS * mifflinStJeorBmr(base)) / BUDGET_V2.REFERENCE_BMR;
    const clamped = Math.min(BUDGET_V2.MAX_DAILY_POINTS, Math.max(BUDGET_V2.MIN_DAILY_POINTS, raw));
    expect(maintain).toBe(Math.round(clamped * BUDGET_V2.MAINTENANCE_UPLIFT));
    expect(maintain).toBeGreaterThan(loss);
  });
  it("clamps the weight-loss budget to the product range", () => {
    expect(
      calculatePersonalizedPointsBudget({ ...base, age: 90, heightCm: 145, weightKg: 40 }),
    ).toBe(BUDGET_V2.MIN_DAILY_POINTS);
    expect(
      calculatePersonalizedPointsBudget({
        sexAtBirth: "male",
        age: 20,
        heightCm: 200,
        weightKg: 160,
        goalMode: "lose",
      }),
    ).toBe(BUDGET_V2.MAX_DAILY_POINTS);
  });
});

describe("age from birth date", () => {
  it("counts whole years and flips exactly on the birthday", () => {
    expect(ageFromBirthDate("1986-09-19", "2026-09-18")).toBe(39);
    expect(ageFromBirthDate("1986-09-19", "2026-09-19")).toBe(40);
    expect(ageFromBirthDate("1986-09-19", "2026-09-20")).toBe(40);
    expect(ageFromBirthDate("2000-02-29", "2025-02-28")).toBe(24);
    expect(ageFromBirthDate("2000-02-29", "2025-03-01")).toBe(25);
  });
  it("the budget changes on the birthday without any stored age", () => {
    const facts = {
      sexAtBirth: "male" as const,
      birthDate: "1966-09-19",
      heightCm: 178,
      goalMode: "lose" as const,
    };
    const before = resolvePointsBudget(facts, 82, "2026-09-18");
    const after = resolvePointsBudget(facts, 82, "2026-09-19");
    expect(before.source).toBe("personalized");
    expect(after.budget).toBeLessThanOrEqual(before.budget);
  });
});

describe("resolvePointsBudget: override → personalised → fallback", () => {
  const complete = {
    sexAtBirth: "female" as const,
    birthDate: "1986-01-01",
    heightCm: 165,
    goalMode: "lose" as const,
  };
  it("missing facts → documented fallback, listing what is missing; never blocks", () => {
    expect(resolvePointsBudget(undefined, undefined)).toEqual({
      budget: BUDGET_V2.FALLBACK_DAILY_POINTS,
      source: "fallback",
      missing: ["sex", "birthDate", "height", "weight"],
    });
    expect(resolvePointsBudget(complete, undefined).missing).toEqual(["weight"]);
    expect(resolvePointsBudget({ ...complete, heightCm: null }, 70).missing).toEqual(["height"]);
  });
  it("complete facts + latest weight → personalised", () => {
    const r = resolvePointsBudget(complete, 70, "2026-09-19");
    expect(r.source).toBe("personalized");
    expect(r.missing).toEqual([]);
    expect(r.budget).toBeGreaterThanOrEqual(BUDGET_V2.MIN_DAILY_POINTS);
  });
  it("a manual override wins; clearing it returns to automatic", () => {
    expect(resolvePointsBudget({ ...complete, pointsBudgetOverride: 31 }, 70)).toEqual({
      budget: 31,
      source: "override",
      missing: [],
    });
    expect(resolvePointsBudget({ ...complete, pointsBudgetOverride: null }, 70).source).toBe(
      "personalized",
    );
  });
  it("the old v1 default 30 is never treated as a chosen target (no override → not 30)", () => {
    expect(resolvePointsBudget({}, undefined).budget).not.toBe(30);
  });
});

describe("latest weigh-in", () => {
  it("picks the newest valid weigh-in by date then time; ignores invalid values", () => {
    expect(
      latestWeightKg([
        { dateISO: "2026-09-01", weightKg: 80 },
        { dateISO: "2026-09-10", time: "07:00", weightKg: 79 },
        { dateISO: "2026-09-10", time: "21:00", weightKg: 78.5 },
        { dateISO: "2026-09-12", weightKg: 0 },
      ]),
    ).toBe(78.5);
    expect(latestWeightKg([])).toBeUndefined();
  });
});
