import { describe, it, expect } from "vitest";
import { isSameFoodName, normalizeFoodName } from "./food-normalize";

describe("normalizeFoodName", () => {
  it("trims and collapses duplicate whitespace", () => {
    expect(normalizeFoodName("  גבינה   צהובה  ")).toBe("גבינה צהובה");
    expect(normalizeFoodName("\tחזה\n עוף ")).toBe("חזה עוף");
  });

  it("folds every apostrophe / geresh variant to the same key", () => {
    const keys = ["קוטג׳", "קוטג'", "קוטג’", "קוטג`", "קוטג"].map(normalizeFoodName);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe("קוטג");
  });

  it("folds gershayim inside a word", () => {
    expect(normalizeFoodName("צ׳יפס")).toBe("ציפס");
    expect(normalizeFoodName("צ'יפס")).toBe("ציפס");
    expect(normalizeFoodName("קפוצ׳ינו")).toBe("קפוצינו");
  });

  it("removes niqqud so vocalised text matches plain text", () => {
    expect(normalizeFoodName("עֲגַבְנִיָּה")).toBe("עגבניה");
    expect(normalizeFoodName("לֶחֶם מָלֵא")).toBe("לחם מלא");
  });

  it("folds ktiv male / haser so עגבניה matches עגבנייה", () => {
    expect(normalizeFoodName("עגבנייה")).toBe("עגבניה");
    expect(normalizeFoodName("עגבניה")).toBe("עגבניה");
    expect(isSameFoodName("עגבניה", "עגבנייה")).toBe(true);
    expect(isSameFoodName("שווארמה", "שוארמה")).toBe(true);
    expect(isSameFoodName("לחמנייה", "לחמניה")).toBe(true);
  });

  it("treats hyphens and slashes as word separators", () => {
    expect(normalizeFoodName("לחם-מלא")).toBe("לחם מלא");
    expect(normalizeFoodName("יוגורט/פירות")).toBe("יוגורט פירות");
    expect(normalizeFoodName("קפה־שחור")).toBe("קפה שחור");
  });

  it("drops meaningless punctuation", () => {
    expect(normalizeFoodName("סלט (ירקות)")).toBe("סלט ירקות");
    expect(normalizeFoodName("טונה, במים")).toBe("טונה במים");
  });

  it("is case-insensitive for Latin text", () => {
    expect(isSameFoodName("Cottage", "cottage")).toBe(true);
    expect(normalizeFoodName("Protein Bar")).toBe("protein bar");
  });

  it("is idempotent", () => {
    for (const name of ["קוטג׳", "עגבנייה", "  לחם   מלא ", "צ׳יפס", "Protein Bar"]) {
      const once = normalizeFoodName(name);
      expect(normalizeFoodName(once)).toBe(once);
    }
  });

  it("keeps genuinely different foods apart", () => {
    // פטה (feta) vs פיתה (pita) differ by a real letter, not a doubled one.
    expect(isSameFoodName("פטה", "פיתה")).toBe(false);
    expect(isSameFoodName("שניצל אפוי", "שניצל מטוגן")).toBe(false);
    expect(isSameFoodName("חלב", "חלב שקדים")).toBe(false);
  });

  it("never returns a blank key for a non-blank Hebrew name", () => {
    expect(normalizeFoodName("מים")).toBe("מים");
    expect(normalizeFoodName("  ")).toBe("");
  });
});
