import { describe, expect, it } from "vitest";
import type { DayData, Food, FoodEntry } from "./domain";
import {
  calculatePointsV1,
  formatPoints,
  pointsForDay,
  pointsForEntry,
  pointsRemaining,
} from "./points";

const food = (category?: string, kind?: Food["kind"]): Food => ({
  id: "f1",
  name: "בדיקה",
  category,
  kind,
});

const entry = (patch: Partial<FoodEntry> = {}): FoodEntry => ({
  id: "e1",
  foodId: "f1",
  foodName: "בדיקה",
  mode: "measured",
  amount: 1,
  unit: "יחידה",
  ...patch,
});

describe("internal points v1", () => {
  it("keeps zero-point categories at zero", () => {
    expect(calculatePointsV1(entry({ amount: 500, unit: "גרם" }), food("ירקות ועשבי תיבול"))).toBe(
      0,
    );
    expect(calculatePointsV1(entry({ amount: 3 }), food("פירות"))).toBe(0);
  });

  it("scales measured units and rounds to halves", () => {
    expect(calculatePointsV1(entry({ amount: 150, unit: "גרם" }), food("דגנים ופחמימות"))).toBe(6);
    expect(calculatePointsV1(entry({ amount: 125, unit: "מ״ל" }), food("משקאות"))).toBe(1);
    expect(calculatePointsV1(entry({ amount: 0.5, unit: "יחידה" }), food("לחם ומאפים"))).toBe(1.5);
    expect(calculatePointsV1(entry({ amount: 1, unit: "חצי יחידה" }), food("עוף ובשר"))).toBe(2);
  });

  it("uses the four subjective multipliers", () => {
    expect(
      calculatePointsV1(entry({ mode: "subjective", subjective: "מעט" }), food("מנות ותבשילים")),
    ).toBe(2.5);
    expect(
      calculatePointsV1(entry({ mode: "subjective", subjective: "במידה" }), food("מנות ותבשילים")),
    ).toBe(5);
    expect(
      calculatePointsV1(entry({ mode: "subjective", subjective: "הרבה" }), food("מנות ותבשילים")),
    ).toBe(7.5);
    expect(
      calculatePointsV1(entry({ mode: "subjective", subjective: "מוגזם" }), food("מנות ותבשילים")),
    ).toBe(10);
  });

  it("uses fallback 4 for unknown/custom categories and minimum 0.5", () => {
    expect(calculatePointsV1(entry({ amount: 1 }), food())).toBe(4);
    expect(calculatePointsV1(entry({ amount: 1, unit: "גרם" }), food("קטניות"))).toBe(0.5);
  });

  it("scores coffee as zero in v1 rather than inventing milk/sugar precision", () => {
    expect(
      calculatePointsV1(
        entry({ coffee: { type: "אספרסו", milk: "ללא חלב" } }),
        food("משקאות", "coffee"),
      ),
    ).toBe(0);
  });

  it("prefers persisted snapshots and totals a day", () => {
    const snap = entry({ pointsValue: 3.5, pointsModelVersion: "v1" });
    expect(pointsForEntry(snap, food("חטיפים ומתוקים"))).toBe(3.5);
    const day: DayData = {
      meals: {
        breakfast: { slot: "breakfast", status: "logged", entries: [snap] },
        morning_snack: { slot: "morning_snack", status: "empty", entries: [] },
        lunch: { slot: "lunch", status: "empty", entries: [] },
        afternoon_snack: { slot: "afternoon_snack", status: "empty", entries: [] },
        dinner: { slot: "dinner", status: "empty", entries: [] },
        late: { slot: "late", status: "empty", entries: [] },
      },
    };
    expect(pointsForDay(day, [food("חטיפים ומתוקים")])).toBe(3.5);
    expect(pointsRemaining(3.5, 30)).toBe(26.5);
    expect(formatPoints(3.5)).toContain("3");
  });
});
