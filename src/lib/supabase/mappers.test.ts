import { describe, it, expect } from "vitest";
import {
  entryFromRow,
  entryToRow,
  mealFromRows,
  slotToSlug,
  slugToSlot,
  statusFromDb,
  statusToDb,
  subjectiveFromDb,
  subjectiveToDb,
} from "./mappers";
import type { FoodEntry, MealSlotId } from "../domain";
import { MEAL_SLOTS } from "../domain";
import type { FoodEntryRow } from "./database.types";

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
