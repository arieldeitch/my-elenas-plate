import { describe, it, expect } from "vitest";
import { isSubjectiveAmount, parseAmount, validateMeasured, validateMode } from "./quantity";

describe("validateMeasured", () => {
  it("accepts a positive amount with a unit", () => {
    expect(validateMeasured({ amount: 2, unit: "יחידה" })).toEqual([]);
  });

  it("rejects a non-positive amount", () => {
    expect(validateMeasured({ amount: 0, unit: "גרם" })).toContain("amount");
    expect(validateMeasured({ amount: -1, unit: "גרם" })).toContain("amount");
  });

  it("rejects a missing unit", () => {
    expect(validateMeasured({ amount: 1, unit: undefined })).toContain("unit");
  });

  it("rejects NaN amounts", () => {
    expect(validateMeasured({ amount: NaN, unit: "גרם" })).toContain("amount");
  });
});

describe("parseAmount", () => {
  it("parses comma and dot decimals", () => {
    expect(parseAmount("1,5")).toBe(1.5);
    expect(parseAmount("1.5")).toBe(1.5);
  });

  it("returns NaN for non-numeric input", () => {
    expect(Number.isNaN(parseAmount("abc"))).toBe(true);
  });
});

describe("subjective amounts", () => {
  it("recognises the four subjective values", () => {
    for (const v of ["מעט", "במידה", "הרבה", "מוגזם"]) {
      expect(isSubjectiveAmount(v)).toBe(true);
    }
  });

  it("does not treat a number-like string as subjective (never converted)", () => {
    expect(isSubjectiveAmount("2")).toBe(false);
  });

  it("validateMode keeps modes independent", () => {
    expect(validateMode("subjective", "הרבה")).toBe(true);
    expect(validateMode("measured", { amount: 1, unit: "כוס" })).toBe(true);
    expect(validateMode("measured", { amount: 0, unit: "כוס" })).toBe(false);
  });
});
