/**
 * DEC-035 acceptance — the scoring engine against the REAL dataset.
 * Items 1–8, 13, 14 of the run's mandatory list.
 */
import { describe, it, expect } from "vitest";
import {
  aliasSafetyIssues,
  applyBenefit,
  benefitEligibility,
  findGroupForName,
  formatPortion,
  getReferenceIndex,
  resolvePortion,
  resolveReferenceItem,
  scalePoints,
  suggestSimilar,
  resolveCatalog,
  type ReferenceRuntimeItem as ReferenceItem,
} from "./index";
import { parseQuantityText } from "./quantity-parse";
import { scoreDetails } from "../points";
import auditDataset from "@/data/points-reference/reference.v1.json";

const auditItems = auditDataset.items;

const index = getReferenceIndex();
const byRow = (row: number): ReferenceItem => {
  const item = [...index.itemsById.values()].find((i) => i.sourceRow === row);
  if (!item) throw new Error(`row ${row} missing`);
  return item;
};
const only = (name: string): ReferenceItem => {
  const g = findGroupForName(index, name);
  if (!g || g.items.length !== 1) throw new Error(`${name}: expected exactly one active row`);
  return g.items[0];
};

describe("1. exact match to a food and its reference portion", () => {
  it("אבוקדו · 30 גרם = 1 נק׳ exactly, basis reference:exact", () => {
    const item = only("אבוקדו");
    expect(item.portion?.grams).toBe(30);
    const r = resolveReferenceItem(item, { mode: "measured", amount: 30, unit: "גרם" });
    expect(r).toEqual({ kind: "exact", points: 1, scale: 1 });
    const scored = scoreDetails({
      mode: "measured",
      amount: 30,
      unit: "גרם",
      referenceItemId: item.id,
    });
    expect(scored.pointsValue).toBe(1);
    expect(scored.pointsBasis).toBe("reference:exact");
    expect(scored.referenceItemId).toBe(item.id);
  });

  it("a count portion matches by its own label: אגוז ברזיל · 2 יחידות = 1", () => {
    const item = byRow(16); // אגוז ברזיל, 2 יחידות, 1
    const r = resolveReferenceItem(item, { mode: "measured", amount: 2, unit: "יחידה" });
    expect(r.kind).toBe("exact");
    expect(r.points).toBe(1);
  });
});

describe("2. proportional calculation in grams", () => {
  it("scales gram↔gram only: 60 גרם אבוקדו = 2, 15 גרם = 0.5, 100 גרם אגוז ברזיל = 19", () => {
    const avocado = only("אבוקדו");
    expect(
      resolveReferenceItem(avocado, { mode: "measured", amount: 60, unit: "גרם" }),
    ).toMatchObject({
      kind: "scaled",
      points: 2,
      scale: 2,
    });
    expect(
      resolveReferenceItem(avocado, { mode: "measured", amount: 15, unit: "גרם" }).points,
    ).toBe(0.5);
    const brazil100 = byRow(17); // אגוז ברזיל 100 גרם 19
    expect(
      resolveReferenceItem(brazil100, { mode: "measured", amount: 50, unit: "גרם" }).points,
    ).toBe(9.5);
    // kilograms are the same family
    expect(
      resolveReferenceItem(brazil100, { mode: "measured", amount: 0.1, unit: "ק״ג" }).points,
    ).toBe(19);
  });

  it("a count portion with an explicit gram equivalent scales by grams too (1 כף / 15 גרם)", () => {
    const soup = byRow(10); // אבקת מרק 1 כף / 15 גרם = 1
    expect(soup.portion?.grams).toBe(15);
    expect(resolveReferenceItem(soup, { mode: "measured", amount: 30, unit: "גרם" }).points).toBe(
      2,
    );
    expect(resolveReferenceItem(soup, { mode: "measured", amount: 2, unit: "כף" }).points).toBe(2);
  });
});

describe("3. proportional calculation in millilitres", () => {
  it("ml↔ml from the explicit 250 מ״ל of a cup portion; litres are the same family", () => {
    const item = [...index.itemsById.values()].find(
      (i) => i.status === "active" && i.portion?.ml === 250 && i.points > 0 && !i.benefitOf,
    )!;
    const r = resolveReferenceItem(item, { mode: "measured", amount: 500, unit: "מ״ל" });
    expect(r.kind).toBe("scaled");
    expect(r.points).toBe(scalePoints(item.points, 2));
    expect(
      resolveReferenceItem(item, { mode: "measured", amount: 0.25, unit: "ליטר" }).points,
    ).toBe(item.points);
  });
});

describe("4. half points without wrong rounding", () => {
  it("keeps the source half-point and rounds scaled values to the nearest 0.5, never to a whole", () => {
    const cocoa = byRow(12); // אבקת קקאו לא ממותקת כף/10 גרם = 0.5
    expect(cocoa.points).toBe(0.5);
    expect(resolveReferenceItem(cocoa, { mode: "measured", amount: 1, unit: "כף" }).points).toBe(
      0.5,
    );
    expect(resolveReferenceItem(cocoa, { mode: "measured", amount: 3, unit: "כף" }).points).toBe(
      1.5,
    );
    expect(resolveReferenceItem(cocoa, { mode: "measured", amount: 25, unit: "גרם" }).points).toBe(
      1.5,
    ); // 1.25 → 1.5
    expect(scalePoints(2.5, 1)).toBe(2.5);
    expect(scalePoints(3, 0.5)).toBe(1.5);
    expect(scalePoints(3, 0.1)).toBe(0.5); // never 0 for a non-zero food
    expect(scalePoints(0, 4)).toBe(0);
  });
});

describe("5. no conversion between before-cooking and after-cooking", () => {
  it("raw and cooked are different rows; the engine never crosses rows, and an alias between them is refused", () => {
    const raw = findGroupForName(index, "אווז ברווז ללא עור טרי לפני בישול")!;
    expect(raw.items).toHaveLength(1);
    // Grams entered for the RAW row scale the raw row only.
    const r = resolveReferenceItem(raw.items[0], { mode: "measured", amount: 200, unit: "גרם" });
    expect(r.points).toBe(8);
    expect(aliasSafetyIssues("עוף אחרי בישול", "עוף לפני בישול")).toContain(
      "cooking_state_differs",
    );
    expect(aliasSafetyIssues("אורז מבושל", "אורז יבש")).toContain("cooking_state_differs");
    expect(aliasSafetyIssues("יוגורט לייט", "יוגורט")).toContain("light_or_diet_variant_differs");
    expect(aliasSafetyIssues("פאי רועים - מתכון", "פאי רועים")).toContain("recipe_vs_ingredient");
    expect(aliasSafetyIssues("עגבניה", "עגבנייה")).toEqual([]);
  });
});

describe("6. no cup→gram conversion without an explicit reference", () => {
  it("blocks grams for a cup-only portion and blocks a cup for a gram-only portion", () => {
    const cupOnly = [...index.itemsById.values()].find(
      (i) =>
        i.status === "active" &&
        i.portion?.primary?.label === "כוס" &&
        i.portion.grams == null &&
        i.portion.ml == null,
    )!;
    expect(resolveReferenceItem(cupOnly, { mode: "measured", amount: 100, unit: "גרם" })).toEqual({
      kind: "blocked",
      points: null,
      reason: "no_weight_reference",
    });
    expect(
      resolveReferenceItem(cupOnly, { mode: "measured", amount: 250, unit: "מ״ל" }).reason,
    ).toBe("no_volume_reference");
    const gramOnly = only("אבוקדו");
    expect(
      resolveReferenceItem(gramOnly, { mode: "measured", amount: 1, unit: "כוס" }).reason,
    ).toBe("count_unit_mismatch");
    expect(
      resolveReferenceItem(gramOnly, { mode: "measured", amount: 1, unit: "יחידה" }).reason,
    ).toBe("count_unit_mismatch");
    expect(
      resolveReferenceItem(gramOnly, { mode: "measured", amount: 1, unit: "מנה" }).reason,
    ).toBe("count_unit_mismatch");
    // כף never becomes כפית
    const soup = byRow(10);
    expect(resolveReferenceItem(soup, { mode: "measured", amount: 3, unit: "כפית" }).reason).toBe(
      "count_unit_mismatch",
    );
    // The ENGINE still refuses: it never invents a number of its own.
    // DEC-038 adds a layer above it, and only where the same reference group
    // carries the evidence — see the two cases below.
    const scored = scoreDetails({
      mode: "measured",
      amount: 100,
      unit: "גרם",
      referenceItemId: cupOnly.id,
    });
    // אגוז מלך טחון has 1 כף / 8 גרם = 2 נק׳ alongside the cup row, so grams
    // per cup follow from the group itself. It is scored, and it is labelled.
    expect(scored.pointsBasis).toBe("reference:estimated_conversion");
    expect(scored.pointsValue).not.toBeNull();
    expect(scored.basisSnapshot?.conversion).toMatchObject({
      kind: "reference_estimate",
      unit: "כוס",
    });

    // With no such evidence the answer is still "no", not a guess: אבוקדו is a
    // single gram-only row, so a cup of it cannot be scored at all.
    const stillBlocked = scoreDetails({
      mode: "measured",
      amount: 1,
      unit: "כוס",
      referenceItemId: gramOnly.id,
    });
    expect(stillBlocked.pointsBasis).toBe("reference:blocked");
    expect(stillBlocked.pointsValue).toBeNull();
  });
});

describe("7. several variations of the same food", () => {
  it("a group exposes every active portion and the app must pick one — the engine scores only the chosen row", () => {
    const g = findGroupForName(index, "אגוז ברזיל")!;
    expect(g.items.map((i) => `${formatPortion(i.portion)}=${i.points}`)).toEqual([
      "2 יחידה=1",
      "100 גרם=19",
    ]);
    // Unresolved group (no chosen row) → blocked, never "the first one".
    const food = resolveCatalog(index, []).active.find((f) => f.name === "אגוז ברזיל")!;
    expect(food.referenceGroupKey).toBe(g.key);
    const ambiguous = scoreDetails({ mode: "measured", amount: 2, unit: "יחידה" }, food);
    expect(ambiguous.pointsBasis).toBe("unscored:ambiguous");
    expect(ambiguous.pointsValue).toBeNull();
    // Chosen row → scored against that row only.
    const chosen = scoreDetails(
      { mode: "measured", amount: 4, unit: "יחידה", referenceItemId: g.items[0].id },
      food,
    );
    expect(chosen.pointsValue).toBe(2);
    expect(chosen.pointsBasis).toBe("reference:scaled");
  });
});

describe("8. conflicting rows", () => {
  it("both yogurt rows are conflict → hidden from results and never scored; the rice-drink rows too", () => {
    const yogurt = [byRow(568), byRow(569)];
    expect(yogurt.map((i) => i.status)).toEqual(["conflict", "conflict"]);
    expect(yogurt.map((i) => i.points)).toEqual([4, 5]);
    // The audit dataset (seeded into the DB) records the shared conflict group.
    const audit = (row: number) => auditItems.find((i) => i.sourceRow === row)!;
    expect(audit(568).conflictGroup).toBeDefined();
    expect(audit(568).conflictGroup).toBe(audit(569).conflictGroup);
    for (const item of yogurt) {
      expect(
        resolveReferenceItem(item, { mode: "measured", amount: 200, unit: "גרם" }).reason,
      ).toBe("status_not_active");
    }
    const g = findGroupForName(index, yogurt[0].displayName)!;
    expect(g.items).toHaveLength(0); // nothing offered as a default
    expect(g.hiddenCount).toBe(2);
    // conflict-only groups are not turned into searchable foods
    expect(resolveCatalog(index, []).active.some((f) => f.name === yogurt[0].displayName)).toBe(
      false,
    );
    const rice = [byRow(794), byRow(795)];
    expect(rice.map((i) => i.status)).toEqual(["conflict", "conflict"]);
    expect(new Set(rice.map((i) => i.category)).size).toBe(2);
  });
});

describe("13. a conditional 0-point rule is not applied without eligibility", () => {
  it("pear keeps its base 2 points; the fruit allowance is attached, not applied", () => {
    const pear = only("אגס");
    expect(pear.points).toBe(2);
    expect(pear.benefits?.map((b) => b.rule)).toEqual(["fruit_daily_allowance"]);
    // No benefit requested → base points.
    const plain = scoreDetails({
      mode: "measured",
      amount: 200,
      unit: "גרם",
      referenceItemId: pear.id,
    });
    expect(plain).toMatchObject({ pointsValue: 2, basePoints: 2, pointsBasis: "reference:exact" });
    expect(plain.benefitRule).toBeUndefined();
    // Benefit requested but no eligibility context (no day entries) → still base.
    const ok = benefitEligibility("fruit_daily_allowance", []);
    expect(ok).toEqual({ eligible: true, usedToday: 0, cap: 3 });
    const applied = applyBenefit(2, pear.benefits![0], ok);
    expect(applied).toEqual({
      basePoints: 2,
      appliedPoints: 0,
      benefitRule: "fruit_daily_allowance",
    });
    const notEligible = applyBenefit(2, pear.benefits![0], {
      eligible: false,
      usedToday: 3,
      cap: 3,
      reason: "cap_reached",
    });
    expect(notEligible).toEqual({ basePoints: 2, appliedPoints: 2, benefitRule: null });
  });

  it("the protein 0-point allowance is not provable from the source → never eligible, base points stay", () => {
    const tofu = byRow(529); // טופו (במסגרת תוספת חלבון ב-
    expect(tofu.rule).toBe("protein_zero_allowance");
    expect(tofu.portion).toBeNull();
    const e = benefitEligibility("protein_zero_allowance", []);
    expect(e.eligible).toBe(false);
    expect(e.reason).toBe("rule_not_provable");
    // and a base food the rule attaches to is still scored by its own value
    const attached = [...index.itemsById.values()].filter(
      (i) => i.rule === "protein_zero_allowance" && i.benefitOf,
    );
    expect(attached.length).toBeGreaterThan(0);
    const scorable = attached
      .map((i) => index.itemsById.get(i.benefitOf!)!)
      .find((b) => b.status === "active" && b.portion?.grams);
    expect(scorable).toBeDefined();
    {
      const base = scorable!;
      expect(base.benefits?.some((b) => b.rule === "protein_zero_allowance")).toBe(true);
      expect(base.points).toBeGreaterThan(0);
      const s = scoreDetails({
        mode: "measured",
        amount: 100,
        unit: "גרם",
        referenceItemId: base.id,
        benefitRule: "protein_zero_allowance",
      });
      expect(s.pointsValue).toBe(base.points);
      expect(s.benefitRule).toBeUndefined();
    }
    // A benefit that the row does not carry can never be applied.
    const avocado = only("אבוקדו");
    const s = scoreDetails({
      mode: "measured",
      amount: 30,
      unit: "גרם",
      referenceItemId: avocado.id,
      benefitRule: "fruit_daily_allowance",
    });
    expect(s.pointsValue).toBe(1);
    expect(s.benefitRule).toBeUndefined();
  });
});

describe("14. a daily benefit cannot be used twice on the same portion / beyond its cap", () => {
  it("counts each entry once, excludes the entry being edited, and stops at the cap", () => {
    const day = [
      { id: "e1", benefitRule: "fruit_daily_allowance" as const },
      { id: "e1", benefitRule: "fruit_daily_allowance" as const }, // the same entry seen twice
      { id: "e2", benefitRule: "fruit_daily_allowance" as const },
    ];
    expect(benefitEligibility("fruit_daily_allowance", day)).toEqual({
      eligible: true,
      usedToday: 2,
      cap: 3,
    });
    expect(benefitEligibility("fruit_daily_allowance", day, "e2")).toMatchObject({ usedToday: 1 });
    const full = [...day, { id: "e3", benefitRule: "fruit_daily_allowance" as const }];
    expect(benefitEligibility("fruit_daily_allowance", full)).toEqual({
      eligible: false,
      usedToday: 3,
      cap: 3,
      reason: "cap_reached",
    });
    const pear = only("אגס");
    const fourth = scoreDetails(
      {
        id: "e4",
        mode: "measured",
        amount: 200,
        unit: "גרם",
        referenceItemId: pear.id,
        benefitRule: "fruit_daily_allowance",
      },
      undefined,
      { dayEntries: full },
    );
    expect(fourth.pointsValue).toBe(2); // base, not 0
    expect(fourth.benefitRule).toBeUndefined();
    const third = scoreDetails(
      {
        id: "e3",
        mode: "measured",
        amount: 200,
        unit: "גרם",
        referenceItemId: pear.id,
        benefitRule: "fruit_daily_allowance",
      },
      undefined,
      { dayEntries: day },
    );
    expect(third.pointsValue).toBe(0);
    expect(third.basePoints).toBe(2);
    expect(third.benefitRule).toBe("fruit_daily_allowance");
  });
});

describe("quantity parser (cleaning rule Q-*)", () => {
  it("parses the source shapes and leaves the unknown ones unparsed", () => {
    expect(parseQuantityText("100 גרם").portion).toMatchObject({ family: "weight", grams: 100 });
    expect(parseQuantityText("1 כף / 15 גרם").portion).toMatchObject({
      family: "count",
      grams: 15,
      primary: { amount: 1, label: "כף", appUnit: "כף" },
    });
    expect(parseQuantityText('1 כוס / 250 מ"ל').portion).toMatchObject({
      family: "count",
      ml: 250,
    });
    expect(parseQuantityText('1 כוס / 250 מ"').portion?.ml).toBeUndefined(); // truncated → no ml
    expect(parseQuantityText("חצי כוס").portion?.primary).toMatchObject({
      amount: 0.5,
      label: "כוס",
    });
    expect(parseQuantityText("ללביבה").portion?.primary).toMatchObject({
      amount: 1,
      label: "לביבה",
      appUnit: "יחידה",
    });
    expect(parseQuantityText("כוסית").portion?.primary?.label).toBe("כוסית");
    expect(parseQuantityText(".")).toMatchObject({ portion: null, missing: true });
    expect(parseQuantityText(null)).toMatchObject({ portion: null, missing: true });
    expect(parseQuantityText(100)).toMatchObject({ portion: null, unitless: true });
    expect(parseQuantityText("מנה בינונית").portion?.primary?.label).toBe("מנה בינונית");
  });

  it("approximate count labels (כוסית) resolve only at the exact reference amount", () => {
    const portion = parseQuantityText("1 כוסית").portion!;
    expect(resolvePortion(portion, 3, { mode: "measured", amount: 1, unit: "כוס" }).points).toBe(3);
    expect(resolvePortion(portion, 3, { mode: "measured", amount: 2, unit: "כוס" }).reason).toBe(
      "approximate_label_needs_exact_amount",
    );
  });
});

describe("suggestions for an unknown food are marked, never automatic", () => {
  it("returns similar active rows with a confidence level and skips conditional / hidden rows", () => {
    const s = suggestSimilar(index.itemsById.values(), "יוגורט טבעי 3% שומן");
    expect(s.length).toBeGreaterThan(0);
    expect(
      s.every((x) => x.item.status === "active" && x.item.rule !== "protein_zero_allowance"),
    ).toBe(true);
    expect(["high", "medium", "low"]).toContain(s[0].confidence);
    expect(suggestSimilar(index.itemsById.values(), "")).toEqual([]);
  });
});
