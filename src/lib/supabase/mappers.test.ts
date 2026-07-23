import { describe, it, expect } from "vitest";
import {
  deriveFavoritesRecents,
  entryFromRow,
  entryToRow,
  foodFromRow,
  foodToRow,
  mealFromRows,
  preferenceFromRow,
  slotToSlug,
  slugToSlot,
  statusFromDb,
  statusToDb,
  subjectiveFromDb,
  subjectiveToDb,
  type Preference,
} from "./mappers";
import type { Food, FoodEntry, MealSlotId } from "../domain";
import { MEAL_SLOTS } from "../domain";
import type { FoodEntryRow, FoodPreferenceRow, FoodRow } from "./database.types";

describe("slot mapping", () => {
  it("round-trips every slot id through its slug", () => {
    for (const slot of MEAL_SLOTS) {
      expect(slugToSlot(slotToSlug(slot))).toBe(slot);
    }
  });
  it("uses the canonical slugs", () => {
    expect(MEAL_SLOTS.map(slotToSlug)).toEqual([
      "opening_window",
      "first_snack",
      "main_meal",
      "afternoon_snack",
      "dinner",
      "extra_meal",
    ]);
  });
});

describe("status mapping", () => {
  it("maps empty <-> unmarked", () => {
    expect(statusToDb("empty")).toBe("unmarked");
    expect(statusFromDb("unmarked")).toBe("empty");
  });
  it("passes logged/skipped through", () => {
    expect(statusToDb("logged")).toBe("logged");
    expect(statusFromDb("skipped")).toBe("skipped");
  });
});

describe("subjective mapping", () => {
  it("round-trips Hebrew <-> english", () => {
    for (const v of ["מעט", "במידה", "הרבה", "מוגזם"] as const) {
      expect(subjectiveFromDb(subjectiveToDb(v))).toBe(v);
    }
    expect(subjectiveToDb("הרבה")).toBe("much");
  });
});

describe("entryToRow / entryFromRow", () => {
  const ctx = {
    householdId: "h1",
    profileId: "p1",
    logDate: "2026-07-23",
    slot: "lunch" as MealSlotId,
  };

  it("maps a measured entry", () => {
    const entry: FoodEntry = {
      id: "e1",
      foodId: "f",
      foodName: "אורז",
      mode: "measured",
      amount: 2,
      unit: "כוס",
    };
    const row = entryToRow(entry, ctx);
    expect(row).toMatchObject({
      id: "e1",
      slot: "main_meal",
      quantity_mode: "measured",
      amount: 2,
      unit: "כוס",
      subjective: null,
      coffee: null,
    });
  });

  it("maps a subjective entry to english", () => {
    const entry: FoodEntry = {
      id: "e2",
      foodId: "f",
      foodName: "סלט",
      mode: "subjective",
      subjective: "הרבה",
    };
    const row = entryToRow(entry, ctx);
    expect(row.subjective).toBe("much");
    expect(row.amount).toBeNull();
  });

  it("maps a coffee entry and clears milk type without milk", () => {
    const entry: FoodEntry = {
      id: "e3",
      foodId: "f_coffee",
      foodName: "קפה",
      mode: "measured",
      amount: 1,
      unit: "כוס",
      coffee: { type: "אמריקנו", milk: "ללא חלב", milkType: "סויה" },
    };
    const row = entryToRow(entry, ctx);
    expect(row.coffee).toEqual({ type: "אמריקנו", milk: "ללא חלב" });
  });

  it("reconstructs a coffee entry from a row", () => {
    const row = {
      id: "e4",
      food_id: null,
      food_name: "קפה",
      quantity_mode: "measured",
      amount: 1,
      unit: "ספל",
      subjective: null,
      coffee: { type: "לאטה", milk: "עם חלב", milkType: "שקדים" },
    } as unknown as FoodEntryRow;
    const entry = entryFromRow(row);
    expect(entry.coffee).toEqual({ type: "לאטה", milk: "עם חלב", milkType: "שקדים" });
    expect(entry.unit).toBe("ספל");
  });
});

describe("custom food mapping", () => {
  it("maps a Food to a foods insert with normalized name", () => {
    const food: Food = { id: "abc", name: "  שייק  בננה ", category: "משקאות", defaultUnit: "כוס" };
    const row = foodToRow(food, "H1");
    expect(row).toMatchObject({
      id: "abc",
      household_id: "H1",
      name: "שייק  בננה",
      normalized_name: "שייק בננה",
      default_unit: "כוס",
      kind: "generic",
      is_active: true,
    });
  });

  it("maps a foods row back to a Food", () => {
    const row = {
      id: "abc",
      name: "שייק בננה",
      category: "משקאות",
      default_unit: "כוס",
      kind: "coffee",
    } as unknown as FoodRow;
    const food = foodFromRow(row);
    expect(food.name).toBe("שייק בננה");
    expect(food.kind).toBe("coffee");
    expect(food.suggestedUnits).toContain("יחידה");
  });
});

describe("deriveFavoritesRecents", () => {
  const pref = (foodId: string, isFavorite: boolean, lastUsedAt: string | null): Preference => ({
    foodId,
    isFavorite,
    lastUsedAt,
    useCount: 0,
  });

  it("separates favorites and orders recents newest-first, capped", () => {
    const prefs = [
      pref("a", true, "2026-07-20T10:00:00Z"),
      pref("b", false, "2026-07-23T10:00:00Z"),
      pref("c", true, null),
      pref("d", false, "2026-07-21T10:00:00Z"),
    ];
    const { favorites, recents } = deriveFavoritesRecents(prefs, 2);
    expect(favorites).toEqual(["a", "c"]);
    expect(recents).toEqual(["b", "d"]); // newest first, limited to 2, null excluded
  });

  it("reads a preference row", () => {
    const row = {
      food_id: "x",
      is_favorite: true,
      last_used_at: "2026-07-23T00:00:00Z",
      use_count: 3,
    } as unknown as FoodPreferenceRow;
    expect(preferenceFromRow(row)).toEqual({
      foodId: "x",
      isFavorite: true,
      lastUsedAt: "2026-07-23T00:00:00Z",
      useCount: 3,
    });
  });
});

describe("mealFromRows", () => {
  it("returns logged when entries exist", () => {
    const meal = mealFromRows("lunch", "unmarked", [
      {
        id: "x",
        food_name: "a",
        quantity_mode: "measured",
        amount: 1,
        unit: "כוס",
        subjective: null,
        coffee: null,
        food_id: null,
      } as unknown as FoodEntryRow,
    ]);
    expect(meal.status).toBe("logged");
    expect(meal.entries).toHaveLength(1);
  });
  it("keeps skipped even with no entries", () => {
    expect(mealFromRows("dinner", "skipped", []).status).toBe("skipped");
  });
  it("is empty with no status and no entries", () => {
    expect(mealFromRows("dinner", undefined, []).status).toBe("empty");
  });
});
