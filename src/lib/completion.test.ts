import { describe, it, expect } from "vitest";
import { calcCompletion } from "./completion";
import { MEAL_SLOTS, type DailyMeal, type MealSlotId, type MealStatus } from "./domain";

function meals(statuses: Partial<Record<MealSlotId, MealStatus>>): Record<MealSlotId, DailyMeal> {
  const out = {} as Record<MealSlotId, DailyMeal>;
  for (const s of MEAL_SLOTS) {
    out[s] = { slot: s, status: statuses[s] ?? "empty", entries: [] };
  }
  return out;
}

describe("calcCompletion", () => {
  it("reports empty when nothing is documented", () => {
    const info = calcCompletion(meals({}));
    expect(info.state).toBe("empty");
    expect(info.documented).toBe(0);
    expect(info.total).toBe(6);
  });

  it("reports partial when some slots are documented", () => {
    const info = calcCompletion(meals({ breakfast: "logged", lunch: "logged" }));
    expect(info.state).toBe("partial");
    expect(info.documented).toBe(2);
  });

  it("reports full when all six slots are logged", () => {
    const all = Object.fromEntries(MEAL_SLOTS.map((s) => [s, "logged" as MealStatus]));
    const info = calcCompletion(meals(all));
    expect(info.state).toBe("full");
    expect(info.documented).toBe(6);
  });

  it("counts a skipped meal as complete", () => {
    const all = Object.fromEntries(MEAL_SLOTS.map((s) => [s, "logged" as MealStatus]));
    all.late = "skipped";
    const info = calcCompletion(meals(all));
    expect(info.state).toBe("full");
    expect(info.documented).toBe(6);
  });

  it("mixes logged and skipped toward completeness", () => {
    const info = calcCompletion(meals({ breakfast: "logged", morning_snack: "skipped" }));
    expect(info.state).toBe("partial");
    expect(info.documented).toBe(2);
  });
});
