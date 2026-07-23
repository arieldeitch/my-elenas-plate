import { describe, it, expect } from "vitest";
import { coffeeSummary, isValidCoffee, normalizeCoffee, validateCoffee } from "./coffee";
import type { CoffeeMeta } from "./domain";

describe("validateCoffee", () => {
  it("accepts a valid black coffee", () => {
    expect(validateCoffee({ type: "אמריקנו", milk: "ללא חלב" })).toEqual([]);
  });

  it("accepts coffee with milk and a milk type", () => {
    expect(validateCoffee({ type: "לאטה", milk: "עם חלב", milkType: "שקדים" })).toEqual([]);
  });

  it("requires a coffee type", () => {
    expect(validateCoffee({ milk: "ללא חלב" })).toContain("type");
  });

  it("requires a milk choice", () => {
    expect(validateCoffee({ type: "אספרסו" })).toContain("milk");
  });

  it("rejects a milk type without milk", () => {
    expect(validateCoffee({ type: "אספרסו", milk: "ללא חלב", milkType: "סויה" })).toContain(
      "milkTypeWithoutMilk",
    );
  });

  it("rejects an unknown coffee type", () => {
    expect(validateCoffee({ type: "מוקה" as CoffeeMeta["type"], milk: "ללא חלב" })).toContain(
      "invalidType",
    );
  });
});

describe("normalizeCoffee", () => {
  it("clears the milk type when milk is 'ללא חלב'", () => {
    const result = normalizeCoffee({ type: "אמריקנו", milk: "ללא חלב", milkType: "סויה" });
    expect(result.milkType).toBeUndefined();
  });

  it("keeps the milk type when milk is 'עם חלב'", () => {
    const result = normalizeCoffee({ type: "לאטה", milk: "עם חלב", milkType: "שקדים" });
    expect(result.milkType).toBe("שקדים");
  });

  it("trims and drops empty notes", () => {
    expect(normalizeCoffee({ type: "אספרסו", milk: "ללא חלב", note: "   " }).note).toBeUndefined();
    expect(normalizeCoffee({ type: "אספרסו", milk: "ללא חלב", note: " בלי סוכר " }).note).toBe(
      "בלי סוכר",
    );
  });

  it("produces a valid object after normalisation", () => {
    const normalized = normalizeCoffee({ type: "אמריקנו", milk: "ללא חלב", milkType: "סויה" });
    expect(isValidCoffee(normalized)).toBe(true);
  });
});

describe("coffeeSummary", () => {
  it("summarises milk with type", () => {
    expect(coffeeSummary({ type: "קפוצ׳ינו", milk: "עם חלב", milkType: "חלב דל שומן" })).toBe(
      "קפוצ׳ינו · עם חלב (חלב דל שומן)",
    );
  });

  it("summarises black coffee", () => {
    expect(coffeeSummary({ type: "אספרסו", milk: "ללא חלב" })).toBe("אספרסו · ללא חלב");
  });
});
