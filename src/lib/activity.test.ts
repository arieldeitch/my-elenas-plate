import { describe, it, expect } from "vitest";
import { latestActivity, countEntries } from "./activity";
import type { DayData, FoodEntry, MealSlotId } from "./domain";
import { MEAL_SLOTS } from "./domain";

function day(entries: Partial<Record<MealSlotId, FoodEntry[]>>): DayData {
  const meals = {} as DayData["meals"];
  for (const s of MEAL_SLOTS) {
    const list = entries[s] ?? [];
    meals[s] = { slot: s, status: list.length ? "logged" : "empty", entries: list };
  }
  return { meals };
}
const e = (id: string, foodName: string, loggedAt?: string): FoodEntry => ({
  id,
  foodId: `f_${id}`,
  foodName,
  mode: "measured",
  amount: 1,
  unit: "יחידה",
  loggedAt,
});

describe("latestActivity", () => {
  it("is null for an empty day", () => {
    expect(latestActivity(day({}))).toBeNull();
    expect(countEntries(day({}))).toBe(0);
  });

  it("prefers the newest timestamp regardless of slot order", () => {
    const d = day({
      breakfast: [e("a", "ביצה", "2026-09-18T07:10:00")],
      dinner: [e("b", "סלט", "2026-09-18T19:30:00")],
      lunch: [e("c", "אורז", "2026-09-18T21:05:00")], // logged late, into lunch
    });
    const latest = latestActivity(d)!;
    expect(latest.entry.foodName).toBe("אורז");
    expect(latest.slot).toBe("lunch");
    expect(latest.time).toBe("21:05");
    expect(countEntries(d)).toBe(3);
  });

  it("falls back to slot order when no entry has a timestamp", () => {
    const d = day({ breakfast: [e("a", "ביצה")], dinner: [e("b", "סלט"), e("c", "לחם")] });
    const latest = latestActivity(d)!;
    expect(latest.entry.foodName).toBe("לחם");
    expect(latest.slot).toBe("dinner");
    expect(latest.time).toBeUndefined();
  });

  it("a timestamped entry wins over untimestamped ones", () => {
    const d = day({ dinner: [e("z", "לחם")], breakfast: [e("a", "ביצה", "2026-09-18T07:10:00")] });
    expect(latestActivity(d)!.entry.foodName).toBe("ביצה");
  });
});
