/**
 * DEC-037 engines — manual target, label estimator, weight bridges, dish maths.
 * Pure-level coverage of the run's required acceptance scenarios 1–3, 7–10,
 * 14–16 and the non-negotiable "never guess" rules.
 */
import { describe, it, expect } from "vitest";
import type { LabelInput, Unit, WeightBridge } from "./domain";
import {
  calculatePersonalizedPointsBudget,
  pointsRemaining,
  resolvePointsBudget,
  scoreDetails,
  type ProfileFacts,
} from "./points";
import {
  describeLabelBasis,
  estimateFromLabel,
  estimatedPointsForGrams,
  LABEL_ESTIMATOR_VERSION,
  normalizeLabelTo100g,
  validateLabel,
} from "./label-estimator";
import {
  buildBridgeIndex,
  describeBridge,
  findBridge,
  isWeightUnit,
  resolveGrams,
} from "./weight-bridges";
import { dishServingPoints, dishTotals, resolveIngredient, buildDish } from "./dishes";
import {
  findGroupForName,
  getReferenceIndex,
  selectableItems,
  type ReferenceRuntimeItem,
} from "./points-reference";
import { isMissingRelation } from "./supabase/repositories";

const index = getReferenceIndex();
const refItem = (name: string) => {
  const group = findGroupForName(index, name);
  if (!group) throw new Error(`missing reference food: ${name}`);
  const rows = selectableItems(group);
  if (rows.length === 0) throw new Error(`no selectable row: ${name}`);
  return { group, item: rows[0] };
};

describe("R1 — the manual target is the only source of the daily budget", () => {
  const body: ProfileFacts = {
    sexAtBirth: "female",
    birthDate: "1985-04-02",
    heightCm: 168,
    goalMode: "lose",
  };

  it("1. a manually entered 27 is the effective target", () => {
    const info = resolvePointsBudget({ ...body, pointsBudgetOverride: 27 }, 70);
    expect(info).toMatchObject({ budget: 27, source: "manual" });
    expect(pointsRemaining(10, info.budget)).toBe(17);
  });

  it("2. a new weigh-in does not change the target", () => {
    const facts = { ...body, pointsBudgetOverride: 27 };
    expect(resolvePointsBudget(facts, 70).budget).toBe(27);
    expect(resolvePointsBudget(facts, 62).budget).toBe(27);
    expect(resolvePointsBudget(facts, 95).budget).toBe(27);
  });

  it("3. editing sex / birth date / height / goal does not change the target", () => {
    const base = { ...body, pointsBudgetOverride: 27 };
    for (const patch of [
      { sexAtBirth: "male" as const },
      { birthDate: "1950-01-01" },
      { heightCm: 200 },
      { goalMode: "maintain" as const },
    ]) {
      expect(resolvePointsBudget({ ...base, ...patch }, 70).budget).toBe(27);
    }
  });

  it("4. without a target there is NO number — never 23/30/automatic, and remaining is null", () => {
    // Complete body facts that previously produced an automatic budget.
    const info = resolvePointsBudget(body, 70);
    expect(info.budget).toBeNull();
    expect(info.source).toBe("none");
    expect(pointsRemaining(12, info.budget)).toBeNull();
    // and nothing in the resolution equals the old fallbacks
    expect([23, 30]).not.toContain(info.budget as never);
    // The BMR helper still exists as the documented future seam, unused here.
    expect(
      calculatePersonalizedPointsBudget({
        sexAtBirth: "female",
        age: 40,
        heightCm: 168,
        weightKg: 70,
        goalMode: "lose",
      }),
    ).toBeGreaterThan(0);
  });

  it("a zero or negative stored value is not a target either", () => {
    expect(resolvePointsBudget({ pointsBudgetOverride: 0 }).budget).toBeNull();
    expect(resolvePointsBudget({ pointsBudgetOverride: -5 }).budget).toBeNull();
    expect(resolvePointsBudget(undefined).budget).toBeNull();
  });
});

describe("R5 — the label estimator is deterministic and never fabricates", () => {
  const per100: LabelInput = {
    basis: "per_100g",
    calories: 400,
    proteinG: 10,
    fiberG: 5,
    saturatedFatG: 3,
    addedSugarG: 20,
  };

  it("9. per-100g label → a stable estimate with its version", () => {
    const a = estimateFromLabel(per100);
    const b = estimateFromLabel(per100);
    expect(a.pointsPer100g).toBe(b.pointsPer100g);
    expect(a.pointsPer100g).toBeGreaterThan(0);
    expect(a.version).toBe(LABEL_ESTIMATOR_VERSION);
    expect(a.facts.servingAmount).toBe(100);
    expect(a.facts.servingUnit).toBe("גרם");
  });

  it("10. a per-serving label normalises to the same estimate as its per-100g twin", () => {
    const perServing: LabelInput = {
      basis: "per_serving",
      servingWeightG: 50,
      calories: 200,
      proteinG: 5,
      fiberG: 2.5,
      saturatedFatG: 1.5,
      addedSugarG: 10,
    };
    expect(estimateFromLabel(perServing).pointsPer100g).toBeCloseTo(
      estimateFromLabel(per100).pointsPer100g,
      10,
    );
    expect(normalizeLabelTo100g(perServing).calories).toBe(400);
    expect(describeLabelBasis(perServing)).toContain("50");
  });

  it("an absent optional value stays absent — it is not turned into a measured zero", () => {
    const facts = normalizeLabelTo100g({ basis: "per_100g", calories: 120, proteinG: 4 });
    expect(facts.proteinG).toBe(4);
    expect("fiberG" in facts).toBe(false);
    expect("addedSugarG" in facts).toBe(false);
  });

  it("refuses a per-serving label with no serving weight, and negative values", () => {
    expect(validateLabel({ basis: "per_serving", calories: 100 })).toContain(
      "serving_weight_required",
    );
    expect(validateLabel({ basis: "per_serving", calories: 100, servingWeightG: 0 })).toContain(
      "serving_weight_invalid",
    );
    expect(validateLabel({ basis: "per_100g" })).toContain("calories_missing");
    expect(validateLabel({ basis: "per_100g", calories: 10, proteinG: -1 })).toContain(
      "negative_value",
    );
    expect(validateLabel(per100)).toEqual([]);
  });

  it("scales by weight with half-point logging precision, never to a silent zero", () => {
    expect(estimatedPointsForGrams(4, 100)).toBe(4);
    expect(estimatedPointsForGrams(4, 50)).toBe(2);
    expect(estimatedPointsForGrams(4, 25)).toBe(1);
    expect(estimatedPointsForGrams(4, 5)).toBe(0.5); // 0.2 → the minimum, not 0
    expect(estimatedPointsForGrams(0, 200)).toBe(0); // a genuine 0 stays 0
    expect(estimatedPointsForGrams(4, 0)).toBe(0);
  });
});

describe("R4 — weight bridges are explicit, per identity, and never inferred", () => {
  const spoon: WeightBridge = {
    id: "b1",
    sourceKind: "reference",
    sourceKey: "טחינה גולמית",
    unit: "כף",
    gramsPerUnit: 15,
    provenance: "user_measured",
  };
  const bridges = buildBridgeIndex([spoon]);

  it("converts only the exact source + unit it was stated for", () => {
    expect(findBridge(bridges, { kind: "reference", key: "טחינה גולמית" }, "כף")).toBe(spoon);
    // another unit of the same food
    expect(findBridge(bridges, { kind: "reference", key: "טחינה גולמית" }, "כוס")).toBeUndefined();
    // another food
    expect(findBridge(bridges, { kind: "reference", key: "חמאת בוטנים" }, "כף")).toBeUndefined();
    // another source kind with the same key
    expect(findBridge(bridges, { kind: "estimated", key: "טחינה גולמית" }, "כף")).toBeUndefined();
  });

  it("weight units never need a bridge; other units do", () => {
    expect(isWeightUnit("גרם")).toBe(true);
    expect(isWeightUnit("ק״ג")).toBe(true);
    expect(isWeightUnit("כף")).toBe(false);
    expect(resolveGrams(bridges, { kind: "reference", key: "x" }, 2, "ק״ג")).toEqual({
      kind: "weight",
      grams: 2000,
    });
    expect(
      resolveGrams(bridges, { kind: "reference", key: "טחינה גולמית" }, 2, "כף"),
    ).toMatchObject({ kind: "bridged", grams: 30 });
    expect(resolveGrams(bridges, { kind: "reference", key: "אחר" }, 2, "כף")).toEqual({
      kind: "needs_bridge",
      unit: "כף",
    });
    expect(describeBridge(spoon)).toBe("1 כף = 15 גרם");
  });
});

describe("R3/R4/R7 — dish ingredients resolve only through safe paths", () => {
  it("6. a gram-based reference ingredient scales directly (no bridge involved)", () => {
    const { group, item } = refItem("אבוקדו"); // 30 גרם = 1
    const resolved = resolveIngredient(
      {
        sourceKind: "reference",
        item,
        name: "אבוקדו",
        groupKey: group.key,
        amount: 60,
        unit: "גרם",
      },
      buildBridgeIndex([]),
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.ingredient.points).toBe(2);
    expect(resolved.ingredient.gramsUsed).toBe(60);
    expect(resolved.ingredient.bridge).toBeUndefined();
    expect(resolved.ingredient.referenceItemId).toBe(item.id);
  });

  it("7. a spoon-based reference ingredient + an explicit 1 כף = 15g bridge resolves grams", () => {
    // A reference row whose portion is a spoon with no gram equivalent.
    const spoonRow = [...index.itemsById.values()].find(
      (i) =>
        i.status === "active" &&
        i.portion?.primary?.appUnit === "כף" &&
        i.portion.grams == null &&
        i.points > 0 &&
        !i.benefitOf,
    )!;
    expect(spoonRow).toBeDefined();
    const groupKey = spoonRow.normalizedName;
    const request = {
      sourceKind: "reference" as const,
      item: spoonRow,
      name: spoonRow.displayName,
      groupKey,
      amount: 30,
      unit: "גרם" as const,
    };

    // 8. without a bridge the same request is BLOCKED, never guessed.
    const blocked = resolveIngredient(request, buildBridgeIndex([]));
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.reason).toBe("needs_bridge");
    expect(blocked.bridgeUnit).toBe("כף");

    const bridge: WeightBridge = {
      id: "b2",
      sourceKind: "reference",
      sourceKey: groupKey,
      referenceItemId: spoonRow.id,
      unit: "כף",
      gramsPerUnit: 15,
      provenance: "label",
    };
    const ok = resolveIngredient(request, buildBridgeIndex([bridge]));
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    // 30 g / 15 g per spoon = 2 spoons
    expect(ok.ingredient.gramsUsed).toBe(30);
    expect(ok.ingredient.bridge).toEqual({ unit: "כף", gramsPerUnit: 15, provenance: "label" });
    expect(ok.ingredient.points).toBeGreaterThan(0);

    // a bridge for ANOTHER identity is not applied to this one
    const otherBridge: WeightBridge = { ...bridge, id: "b3", sourceKey: "משהו אחר" };
    const stillBlocked = resolveIngredient(request, buildBridgeIndex([otherBridge]));
    expect(stillBlocked.ok).toBe(false);
  });

  it("a bridge belongs to the FOOD, so it serves every variation of the same name", () => {
    // "1 יחידה = N גרם" is a property of the food, not of the row that happens
    // to score it, so the bridge key is the reference GROUP (ADR §3). Several
    // rows of one name are variations of one food (DEC-036).
    const byName = new Map<string, ReferenceRuntimeItem[]>();
    for (const item of index.itemsById.values()) {
      if (item.benefitOf || item.status !== "active") continue;
      if (item.portion?.primary?.appUnit == null || item.portion.grams != null) continue;
      const list = byName.get(item.normalizedName) ?? [];
      list.push(item);
      byName.set(item.normalizedName, list);
    }
    const variations = [...byName.values()].find(
      (rows) =>
        rows.length > 1 && rows[0].portion!.primary!.appUnit === rows[1].portion!.primary!.appUnit,
    )!;
    expect(variations).toBeDefined();
    const [first, second] = variations;
    const groupKey = first.normalizedName;
    const unit = first.portion!.primary!.appUnit as Unit;

    const bridge: WeightBridge = {
      id: "b-variation",
      sourceKind: "reference",
      sourceKey: groupKey,
      // Provenance only: the row that was on screen when the fact was stated.
      referenceItemId: first.id,
      unit,
      gramsPerUnit: 40,
      provenance: "user_measured",
    };
    const bridges = buildBridgeIndex([bridge]);
    const request = (item: ReferenceRuntimeItem) => ({
      sourceKind: "reference" as const,
      item,
      name: item.displayName,
      groupKey: item.normalizedName,
      amount: 80,
      unit: "גרם" as const,
    });

    for (const item of [first, second]) {
      const resolved = resolveIngredient(request(item), bridges);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      expect(resolved.ingredient.gramsUsed).toBe(80);
      expect(resolved.ingredient.bridge?.gramsPerUnit).toBe(40);
      // Each variation still scores with ITS OWN points, which is the whole
      // reason the rows are separate.
      expect(resolved.ingredient.referenceItemId).toBe(item.id);
    }
    // …and a bridge stated for a different FOOD is still never applied.
    const otherFood = resolveIngredient(
      request(first),
      buildBridgeIndex([{ ...bridge, id: "x", sourceKey: "שם אחר לגמרי" }]),
    );
    expect(otherFood.ok).toBe(false);
  });

  it("the grams of a count ingredient come from the measure that actually matched", () => {
    // A portion stated as "1 <primary> / N <alternative> / M גרם": asking for
    // the ALTERNATIVE unit must scale by the alternative's own amount, not by
    // the primary's, or the recorded gramsUsed would be wrong by that ratio.
    const row = [...index.itemsById.values()].find(
      (i) =>
        i.status === "active" &&
        !i.benefitOf &&
        i.portion?.grams != null &&
        i.portion.primary?.family === "count" &&
        (i.portion.alternatives ?? []).some((m) => m.family === "count" && m.appUnit),
    );
    if (!row) return; // the dataset has none — nothing to assert
    const alt = row.portion!.alternatives!.find((m) => m.family === "count" && m.appUnit)!;
    const resolved = resolveIngredient(
      {
        sourceKind: "reference",
        item: row,
        name: row.displayName,
        groupKey: row.normalizedName,
        amount: alt.amount,
        unit: alt.appUnit as Unit,
      },
      buildBridgeIndex([]),
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    // `alt.amount` of the alternative unit IS the whole portion → its grams.
    expect(resolved.ingredient.gramsUsed).toBeCloseTo(row.portion!.grams!, 6);
  });

  it("13. a dish may mix reference and estimated ingredients; each keeps its provenance", () => {
    const { group, item } = refItem("אבוקדו");
    const product = {
      id: "ep1",
      name: "קרקר מהסופר",
      label: { basis: "per_100g" as const, calories: 400 },
      pointsPer100g: 6,
      estimatorVersion: LABEL_ESTIMATOR_VERSION,
    };
    const a = resolveIngredient(
      {
        sourceKind: "reference",
        item,
        name: "אבוקדו",
        groupKey: group.key,
        amount: 30,
        unit: "גרם",
      },
      buildBridgeIndex([]),
    );
    const b = resolveIngredient(
      { sourceKind: "estimated", product, amount: 50, unit: "גרם" },
      buildBridgeIndex([]),
    );
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.ingredient.sourceKind).toBe("reference");
    expect(b.ingredient.sourceKind).toBe("estimated");
    expect(b.ingredient.estimatedProductId).toBe("ep1");
    expect(b.ingredient.estimatorVersion).toBe(LABEL_ESTIMATOR_VERSION);
    expect(b.ingredient.points).toBe(3); // 6 per 100 g × 50 g

    const totals = dishTotals([a.ingredient, b.ingredient], 200);
    expect(totals.totalPoints).toBe(4);
    expect(totals.hasEstimatedIngredient).toBe(true);
    expect(totals.pointsPerGram).toBe(0.02);
  });

  it("an invalid amount is refused rather than silently zero", () => {
    const { group, item } = refItem("אבוקדו");
    const r = resolveIngredient(
      {
        sourceKind: "reference",
        item,
        name: "אבוקדו",
        groupKey: group.key,
        amount: 0,
        unit: "גרם",
      },
      buildBridgeIndex([]),
    );
    expect(r).toMatchObject({ ok: false, reason: "invalid_amount" });
  });
});

describe("R8 — final weight, points per gram and serving logging", () => {
  const ingredients = [
    {
      sourceKind: "reference" as const,
      name: "a",
      amount: 100,
      unit: "גרם" as const,
      basisText: "",
      points: 6,
    },
    {
      sourceKind: "reference" as const,
      name: "b",
      amount: 100,
      unit: "גרם" as const,
      basisText: "",
      points: 4,
    },
  ];

  it("14. total / final weight gives a deterministic full-precision rate", () => {
    const dish = buildDish({
      id: "d1",
      name: "תבשיל",
      revision: 1,
      ingredients,
      finalWeightG: 800,
      usualServingWeightG: 250,
    });
    expect(dish.totalPoints).toBe(10);
    expect(dish.pointsPerGram).toBe(10 / 800);
    expect(dish.usualServingWeightG).toBe(250);
    expect(dish.revision).toBe(1);
  });

  it("15/16. a served weight logs the same value whether it was weighed or estimated", () => {
    const rate = 10 / 800; // 0.0125
    expect(dishServingPoints(rate, 250)).toBe(3); // 3.125 → nearest half
    expect(dishServingPoints(rate, 200)).toBe(2.5);
    expect(dishServingPoints(rate, 40)).toBe(0.5); // 0.5 → the floor, never 0
    expect(dishServingPoints(rate, 0)).toBe(0);
    expect(dishServingPoints(0, 250)).toBe(0);
  });

  it("the weight SOURCE is what distinguishes the two snapshots, not the number", () => {
    const dish = buildDish({ id: "d2", name: "x", revision: 1, ingredients, finalWeightG: 800 });
    const dishes = new Map([[dish.id, dish]]);
    const weighed = scoreDetails(
      {
        mode: "measured",
        amount: 250,
        unit: "גרם",
        dishId: dish.id,
        consumedWeightG: 250,
        weightSource: "weighed",
      },
      undefined,
      { dishes },
    );
    const estimated = scoreDetails(
      {
        mode: "measured",
        amount: 250,
        unit: "גרם",
        dishId: dish.id,
        consumedWeightG: 250,
        weightSource: "estimated",
      },
      undefined,
      { dishes },
    );
    expect(weighed).toMatchObject({ pointsValue: 3, pointsBasis: "dish:weighed" });
    expect(estimated).toMatchObject({ pointsValue: 3, pointsBasis: "dish:estimated" });
  });

  it("a dish the context does not know is unscored, never guessed", () => {
    const r = scoreDetails(
      { mode: "measured", amount: 250, unit: "גרם", dishId: "missing", consumedWeightG: 250 },
      undefined,
      { dishes: new Map() },
    );
    expect(r).toMatchObject({ pointsValue: null, pointsBasis: "unscored:no_reference" });
  });
});

describe("R6 — an estimated product scores from its own layer only", () => {
  const product = {
    id: "ep2",
    name: "חטיף",
    label: { basis: "per_100g" as const, calories: 500 },
    pointsPer100g: 8,
    estimatorVersion: LABEL_ESTIMATOR_VERSION,
  };
  const ctx = { estimatedProducts: new Map([[product.id, product]]) };

  it("12. grams score directly and the basis says it is an estimate", () => {
    const r = scoreDetails(
      { mode: "measured", amount: 50, unit: "גרם", estimatedProductId: product.id },
      undefined,
      ctx,
    );
    expect(r).toMatchObject({ pointsValue: 4, pointsBasis: "estimated:label" });
  });

  it("a non-weight unit is blocked until an explicit bridge for THAT product exists", () => {
    const blocked = scoreDetails(
      { mode: "measured", amount: 1, unit: "יחידה", estimatedProductId: product.id },
      undefined,
      ctx,
    );
    expect(blocked).toMatchObject({ pointsValue: null, pointsBasis: "estimated:blocked" });

    const bridge: WeightBridge = {
      id: "b4",
      sourceKind: "estimated",
      sourceKey: product.id,
      estimatedProductId: product.id,
      unit: "יחידה",
      gramsPerUnit: 25,
      provenance: "label",
    };
    const ok = scoreDetails(
      { mode: "measured", amount: 1, unit: "יחידה", estimatedProductId: product.id },
      undefined,
      { ...ctx, bridges: buildBridgeIndex([bridge]) },
    );
    expect(ok).toMatchObject({ pointsValue: 2, pointsBasis: "estimated:label" });
  });

  it("subjective amounts cannot produce an estimate (there are no grams)", () => {
    const r = scoreDetails(
      { mode: "subjective", subjective: "הרבה", estimatedProductId: product.id },
      undefined,
      ctx,
    );
    expect(r).toMatchObject({ pointsValue: null, pointsBasis: "estimated:blocked" });
  });
});

describe("R9/R3 — the canonical reference path is untouched by DEC-037", () => {
  it("22. a reference entry still scores exactly as before, with its own basis", () => {
    const { item } = refItem("אבוקדו");
    const r = scoreDetails({ mode: "measured", amount: 30, unit: "גרם", referenceItemId: item.id });
    expect(r).toMatchObject({ pointsValue: 1, pointsBasis: "reference:exact" });
    // and an unsafe unit is still blocked, not bridged behind the scenes
    const blocked = scoreDetails({
      mode: "measured",
      amount: 1,
      unit: "כוס",
      referenceItemId: item.id,
    });
    expect(blocked).toMatchObject({ pointsValue: null, pointsBasis: "reference:blocked" });
  });
});

describe("schema detection before the migration is applied (deploy constraint)", () => {
  it("treats BOTH the PostgREST and the SQL 'missing relation' codes as 'not applied yet'", () => {
    // Verified against production on 2026-09-23: PostgREST answers an unknown
    // table with PGRST205, so checking only 42P01 would have let the client
    // queue a write that can never succeed.
    expect(isMissingRelation({ code: "PGRST205" })).toBe(true);
    expect(isMissingRelation({ code: "42P01" })).toBe(true);
    // A transport / permission problem must NOT disable the feature.
    expect(isMissingRelation({ code: "42501" })).toBe(false);
    expect(isMissingRelation(new TypeError("Failed to fetch"))).toBe(false);
    expect(isMissingRelation(null)).toBe(false);
    expect(isMissingRelation(undefined)).toBe(false);
  });
});
