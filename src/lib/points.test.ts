import { describe, expect, it } from "vitest";
import type { DayData, FoodEntry } from "./domain";
import {
  DEFAULT_DAILY_POINTS_BUDGET,
  formatPoints,
  pointsForDay,
  pointsForEntry,
  pointsRemaining,
} from "./points";

const measured = (amount = 1, unit: FoodEntry["unit"] = "יחידה"): FoodEntry => ({
  id: "e",
  foodId: "f",
  foodName: "מזון",
  mode: "measured",
  amount,
  unit,
});

describe("points v1", () => {
  it("uses zero categories, coffee zero, and unknown fallback four", () => {
    expect(
      pointsForEntry(measured(), { id: "f", name: "מלפפון", category: "ירקות ועשבי תיבול" }),
    ).toBe(0);
    expect(pointsForEntry({ ...measured(), coffee: { type: "אמריקנו", milk: "ללא חלב" } })).toBe(0);
    expect(pointsForEntry(measured(), { id: "f", name: "לא ידוע" })).toBe(4);
  });

  it("applies deterministic portion, subjective, half-point rounding and minimum rules", () => {
    const food = { id: "f", name: "חטיף", category: "חטיפים ומתוקים" };
    expect(pointsForEntry(measured(50, "גרם"), food)).toBe(3);
    expect(
      pointsForEntry(
        {
          ...measured(),
          mode: "subjective",
          amount: undefined,
          unit: undefined,
          subjective: "הרבה",
        },
        food,
      ),
    ).toBe(9);
    expect(
      pointsForEntry(measured(1, "חצי יחידה"), {
        id: "f",
        name: "גבינה",
        category: "מוצרי חלב ותחליפים",
      }),
    ).toBe(1);
  });

  it("prefers snapshots, falls back for historical nulls, and formats remaining points", () => {
    const day = {
      meals: {
        breakfast: {
          slot: "breakfast",
          status: "logged",
          entries: [{ ...measured(), pointsValue: 7, pointsModelVersion: "v1" }],
        },
      },
    } as unknown as DayData;
    expect(pointsForDay(day, [])).toBe(7);
    expect(pointsRemaining(7.5, DEFAULT_DAILY_POINTS_BUDGET)).toBe(22.5);
    expect(formatPoints(22.5)).toBe("22.5");
  });
});
