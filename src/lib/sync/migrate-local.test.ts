import { describe, it, expect } from "vitest";
import { buildMigrationPayload, totalRows } from "./migrate-local";
import { entriesToDelete } from "./supabase-sync";
import type { PersistedState } from "../persistence";
import type { DailyMeal, DayData, MealSlotId, ProfileId } from "../domain";
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

describe("entriesToDelete", () => {
  it("returns remote ids no longer present locally", () => {
    expect(entriesToDelete(["a", "b", "c"], ["a", "c"])).toEqual(["b"]);
  });
  it("returns nothing when local covers remote", () => {
    expect(entriesToDelete(["a"], ["a", "b"])).toEqual([]);
  });
});
