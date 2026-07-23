import { describe, it, expect } from "vitest";
import { MEAL_SLOTS } from "./domain";
import { MEAL_ICONS, MEAL_LABELS } from "./meal-slots";

describe("meal slots", () => {
  it("defines exactly six slots in order", () => {
    expect(MEAL_SLOTS).toEqual([
      "breakfast",
      "morning_snack",
      "lunch",
      "afternoon_snack",
      "dinner",
      "late",
    ]);
  });

  it("uses the current 16:8-oriented Hebrew labels", () => {
    expect(MEAL_SLOTS.map((s) => MEAL_LABELS[s])).toEqual([
      "פתיחת חלון אכילה",
      "נשנוש ראשון",
      "ארוחה מרכזית",
      "נשנוש אחר הצהריים",
      "ארוחת ערב",
      "ארוחה נוספת",
    ]);
  });

  it("never labels a slot 'ארוחת לילה'", () => {
    expect(Object.values(MEAL_LABELS)).not.toContain("ארוחת לילה");
  });

  it("has an icon for every slot", () => {
    for (const slot of MEAL_SLOTS) {
      expect(MEAL_ICONS[slot]).toBeTruthy();
    }
  });
});
