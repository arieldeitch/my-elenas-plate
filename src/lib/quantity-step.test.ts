import { describe, it, expect } from "vitest";
import { canStep, stepAmount, formatQuantity, usualQuantity, COUNT_UNITS } from "./quantity";

describe("M2-5 quantity stepping", () => {
  it("steps count units by 1 and never below 1", () => {
    const egg = { mode: "measured" as const, amount: 1, unit: "יחידה" as const };
    expect(canStep(egg)).toBe(true);
    expect(stepAmount(egg, 1)).toBe(2);
    expect(stepAmount(egg, -1)).toBeNull(); // 1 → 0 is refused, delete is separate
    expect(stepAmount({ ...egg, amount: 2 }, -1)).toBe(1);
    expect(stepAmount({ ...egg, amount: 3 }, 1)).toBe(4);
  });

  it("keeps fractions and rounds cleanly", () => {
    const half = { mode: "measured" as const, amount: 1.5, unit: "כוס" as const };
    expect(stepAmount(half, 1)).toBe(2.5);
    expect(stepAmount(half, -1)).toBeNull(); // 0.5 < 1
    expect(stepAmount({ ...half, amount: 0.5 }, 1)).toBe(1.5);
    expect(stepAmount({ ...half, amount: 0.1 + 0.2 + 1 }, 1)).toBe(2.3);
  });

  it("does not step weight/volume, subjective or broken quantities", () => {
    expect(canStep({ mode: "measured", amount: 150, unit: "גרם" })).toBe(false);
    expect(canStep({ mode: "measured", amount: 250, unit: "מ״ל" })).toBe(false);
    expect(canStep({ mode: "subjective" })).toBe(false);
    expect(canStep({ mode: "measured", amount: 0, unit: "יחידה" })).toBe(false);
    expect(canStep({ mode: "measured", unit: "יחידה" })).toBe(false);
    expect(stepAmount({ mode: "measured", amount: 150, unit: "גרם" }, 1)).toBeNull();
    for (const u of COUNT_UNITS)
      expect(canStep({ mode: "measured", amount: 1, unit: u })).toBe(true);
  });

  it("formats quantities with Hebrew plurals; 1 stays singular; other units unchanged", () => {
    expect(formatQuantity({ mode: "measured", amount: 1, unit: "יחידה" })).toBe("1 יחידה");
    expect(formatQuantity({ mode: "measured", amount: 2, unit: "יחידה" })).toBe("2 יחידות");
    expect(formatQuantity({ mode: "measured", amount: 3, unit: "פרוסה" })).toBe("3 פרוסות");
    expect(formatQuantity({ mode: "measured", amount: 2, unit: "כוס" })).toBe("2 כוסות");
    expect(formatQuantity({ mode: "measured", amount: 1.5, unit: "כוס" })).toBe("1,5 כוסות");
    expect(formatQuantity({ mode: "measured", amount: 150, unit: "גרם" })).toBe("150 גרם");
    expect(formatQuantity({ mode: "subjective", subjective: "הרבה" })).toBe("הרבה");
  });
});

describe("M2-6 usualQuantity — when a one-tap add can be trusted", () => {
  it("count-unit foods add 1 × unit", () => {
    expect(usualQuantity({ defaultUnit: "יחידה" })).toEqual({
      mode: "measured",
      amount: 1,
      unit: "יחידה",
    });
    expect(usualQuantity({ defaultUnit: "פרוסה" })).toEqual({
      mode: "measured",
      amount: 1,
      unit: "פרוסה",
    });
    expect(usualQuantity({ defaultUnit: "קערה" })?.unit).toBe("קערה");
  });

  it("weight/volume-first foods, unit-less foods and coffee have no trusted default", () => {
    expect(usualQuantity({ defaultUnit: "גרם" })).toBeNull(); // קוטג׳, חזה עוף
    expect(usualQuantity({ defaultUnit: "מ״ל" })).toBeNull();
    expect(usualQuantity({})).toBeNull();
    expect(usualQuantity({ kind: "coffee", defaultUnit: "כוס" })).toBeNull();
  });
});
