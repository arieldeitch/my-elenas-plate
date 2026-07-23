import { describe, it, expect } from "vitest";
import {
  buildFoodMigrationPayload,
  buildMigrationPayload,
  isCustomFoodId,
  totalFoodRows,
  totalRows,
} from "./migrate-local";
import { entriesToDelete } from "./supabase-sync";
import type { PersistedState } from "../persistence";
import type { DailyMeal, DayData, Food, MealSlotId, ProfileId } from "../domain";
import { MEAL_SLOTS } from "../domain";

function emptyDay(): DayData {
  const meals = {} as Record<MealSlotId, DailyMeal>;
  for (const s of MEAL_SLOTS) meals[s] = { slot: s, status: "empty", entries: [] };
  return { meals };
}

function state(): PersistedState {
  const day = emptyDay();
  day.meals.lunch = {
    slot: "lunch",
    status: "logged",
    entries: [
      {
        id: "e1",
        foodId: "f_coffee",
        foodName: "קפה",
        mode: "measured",
        amount: 1,
        unit: "כוס",
        coffee: { type: "אמריקנו", milk: "עם חלב", milkType: "שקדים" },
      },
    ],
  };
  day.meals.dinner = { slot: "dinner", status: "skipped", entries: [] };
  day.fasting = { start: "20:00", end: "12:00" };
  day.workout = { performed: true, type: "הליכה", feeling: "טוב" };

  const emptyProfile = (): Record<string, DayData> => ({});
  const days = { me: { "2026-07-23": day }, elena: emptyProfile() } as PersistedState["days"];
  return {
    version: 1,
    activeProfile: "me" as ProfileId,
    days,
    weighIns: {
      me: [{ id: "w1", dateISO: "2026-07-23", weightKg: 82.4, bodyFatPct: 24 }],
      elena: [],
    },
    favorites: { me: [], elena: [] },
    recents: { me: [], elena: [] },
    foods: [],
  };
}

const profileIdBySlug = { ariel: "PA", alena: "PB" };

describe("buildMigrationPayload", () => {
  it("maps the local 'me' profile to the ariel profile id", () => {
    const p = buildMigrationPayload(state(), "H1", profileIdBySlug);
    expect(p.foodEntries.every((e) => e.profile_id === "PA")).toBe(true);
    expect(p.mealStatuses.every((s) => s.household_id === "H1")).toBe(true);
  });

  it("skips empty slots but keeps logged + skipped", () => {
    const p = buildMigrationPayload(state(), "H1", profileIdBySlug);
    const slots = p.mealStatuses.map((s) => s.slot).sort();
    expect(slots).toEqual(["dinner", "main_meal"]); // extra_meal/dinner slugs
  });

  it("carries coffee metadata, fasting, workout and weigh-ins", () => {
    const p = buildMigrationPayload(state(), "H1", profileIdBySlug);
    expect(p.foodEntries[0].coffee).toEqual({ type: "אמריקנו", milk: "עם חלב", milkType: "שקדים" });
    expect(p.fasting).toHaveLength(1);
    expect(p.workouts[0].performed).toBe(true);
    expect(p.weighIns[0].weight_kg).toBe(82.4);
    expect(totalRows(p)).toBeGreaterThan(0);
  });

  it("does not assign rows when the profile slug is missing", () => {
    const p = buildMigrationPayload(state(), "H1", {}); // no slugs
    expect(totalRows(p)).toBe(0);
  });
});

describe("isCustomFoodId", () => {
  it("treats built-in 'f_' ids as non-custom", () => {
    expect(isCustomFoodId("f_coffee")).toBe(false);
    expect(isCustomFoodId("2b5f...uuid")).toBe(true);
  });
});

describe("buildFoodMigrationPayload", () => {
  function stateWithFoods(): PersistedState {
    const s = state();
    const custom: Food = { id: "cust-uuid-1", name: "שייק בננה", category: "משקאות" };
    return {
      ...s,
      foods: [
        { id: "f_coffee", name: "קפה" }, // built-in — not migrated
        custom, // custom — migrated
      ],
      favorites: { me: ["f_coffee", "cust-uuid-1"], elena: [] },
      recents: { me: ["cust-uuid-1", "f_coffee"], elena: [] },
    };
  }

  it("migrates custom foods only, plus favorites and recents", () => {
    const p = buildFoodMigrationPayload(stateWithFoods(), "H1", { ariel: "PA", alena: "PB" });
    // only the custom food
    expect(p.foods.map((f) => f.id)).toEqual(["cust-uuid-1"]);
    expect(p.foods[0].normalized_name).toBe("שייק בננה");

    // preferences: f_coffee (favorite + recent), cust-uuid-1 (favorite + recent), profile PA
    const byFood = Object.fromEntries(p.preferences.map((r) => [r.food_id, r]));
    expect(byFood["f_coffee"].profile_id).toBe("PA");
    expect(byFood["f_coffee"].is_favorite).toBe(true);
    expect(byFood["cust-uuid-1"].is_favorite).toBe(true);
    // recents newest-first: cust-uuid-1 (index 0) newer than f_coffee (index 1)
    expect(byFood["cust-uuid-1"].last_used_at! > byFood["f_coffee"].last_used_at!).toBe(true);
    expect(totalFoodRows(p)).toBeGreaterThan(0);
  });

  it("skips when the profile slug is missing", () => {
    const p = buildFoodMigrationPayload(stateWithFoods(), "H1", {});
    expect(p.preferences).toEqual([]);
  });
});

describe("entriesToDelete", () => {
  it("returns remote ids no longer present locally", () => {
    expect(entriesToDelete(["a", "b", "c"], ["a", "c"])).toEqual(["b"]);
  });
  it("returns nothing when local covers remote", () => {
    expect(entriesToDelete(["a"], ["a", "b"])).toEqual([]);
  });
});
