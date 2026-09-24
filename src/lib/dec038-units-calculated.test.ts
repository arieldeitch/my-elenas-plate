import { describe, expect, it } from "vitest";
import type { CalculatedProduct, WeightBridge } from "./domain";
import { scoreDetails, scoreEntry } from "./points";
import {
  buildReferenceIndex,
  convertibleUnits,
  referenceEstimateForUnit,
  type ReferenceRuntimeItem,
} from "./points-reference";
import type { ReferenceRuntimeDataset } from "./points-reference/types";
import { buildBridgeIndex } from "./weight-bridges";
import {
  buildCalculatedProduct,
  calculatedRawPoints,
  calculatedServingPoints,
  validateCalculatedInput,
} from "./calculated-products";

let row = 0;
function item(
  name: string,
  points: number,
  portion: ReferenceRuntimeItem["portion"],
  extra: Partial<ReferenceRuntimeItem> = {},
): ReferenceRuntimeItem {
  row += 1;
  return {
    id: `id-${row}`,
    sourceRow: row,
    displayName: name,
    normalizedName: name,
    category: null,
    portion,
    points,
    status: "active",
    rule: null,
    ...extra,
  };
}
const count = (amount: number, appUnit: string) => ({
  amount,
  family: "count" as const,
  label: appUnit,
  appUnit,
});
const weight = (grams: number) => ({
  family: "weight" as const,
  primary: { amount: grams, family: "weight" as const, label: "גרם", appUnit: "גרם" },
  grams,
});

// טחינה: explicit cell "1 כף / 15 גרם" = 2 points
const tahini = item("טחינה", 2, { family: "count", primary: count(1, "כף"), grams: 15 });
// חומוס: a count row (1 כף = 4 נק׳) and a weight row (100 גרם = 20 נק׳) → 20 g/כף.
// The point VALUES matter, not just the ratio: published points are rounded to
// half a point, so a 1-point row carries ±25% on its own and cannot support a
// weight. These do — see "evidence too rounded" below for the other side.
const hummusSpoon = item("חומוס", 4, { family: "count", primary: count(1, "כף") });
const hummusWeight = item("חומוס", 20, weight(100));
// ריבה: inconsistent siblings (1 כף = 2 → 20 g, and 100 g = 5 / 100 g = 20 → 40 g vs 10 g)
const jamSpoon = item("ריבה", 2, { family: "count", primary: count(1, "כף") });
const jamW1 = item("ריבה", 5, weight(100));
const jamW2 = item("ריבה", 20, weight(100));
// עוגייה: count only, no weight evidence
const cookie = item("עוגייה", 2, { family: "count", primary: count(1, "יחידה") });
// "חומוס לייט": a DIFFERENT group — must never borrow חומוס's evidence
const hummusLight = item("חומוס לייט", 1, { family: "count", primary: count(1, "כף") });
// A needs_review row never counts as evidence
const breadSlice = item("לחם", 2, { family: "count", primary: count(1, "פרוסה") });
const breadReview = item("לחם", 3, weight(100), { status: "needs_review" });

const dataset: ReferenceRuntimeDataset = {
  source: { id: "t", version: "t1", fileName: "t", sha256: "t", sheet: "t" },
  items: [
    tahini,
    hummusSpoon,
    hummusWeight,
    jamSpoon,
    jamW1,
    jamW2,
    cookie,
    hummusLight,
    breadSlice,
    breadReview,
  ],
};
const index = buildReferenceIndex(dataset);

const measured = (referenceItemId: string, amount: number, unit: string) => ({
  foodId: "x",
  foodName: "x",
  mode: "measured" as const,
  amount,
  unit: unit as never,
  referenceItemId,
});

describe("DEC-038 reference unit conversion", () => {
  it("3. source cell '1 כף / 15 גרם': 30 g resolves to scale 2, marked explicit", () => {
    const s = scoreDetails(measured(tahini.id, 30, "גרם"), undefined, { reference: index });
    expect(s.pointsValue).toBe(4);
    expect(s.pointsBasis).toBe("reference:scaled");
    expect(s.basisSnapshot?.conversion).toMatchObject({
      kind: "source_explicit",
      unit: "כף",
      gramsPerUnit: 15,
    });
  });

  it("4. coherent same-group evidence gives a visibly estimated conversion", () => {
    expect(referenceEstimateForUnit(index.groupsByKey.get("חומוס")!, "כף")).toMatchObject({
      kind: "ok",
      gramsPerUnit: 20,
    });
    const s = scoreDetails(measured(hummusSpoon.id, 60, "גרם"), undefined, { reference: index });
    expect(s.pointsValue).toBe(12); // 60 g = 3 כף × 4 נק׳
    expect(s.pointsBasis).toBe("reference:estimated_conversion");
    expect(s.basisSnapshot?.conversion?.kind).toBe("reference_estimate");
    expect(s.basisSnapshot?.conversion?.evidenceRows).toEqual([
      hummusSpoon.sourceRow,
      hummusWeight.sourceRow,
    ]);
    // the reverse direction: 2 כפות against the 100 g row
    const back = scoreDetails(measured(hummusWeight.id, 2, "כף"), undefined, { reference: index });
    expect(back.pointsValue).toBe(8); // 2 כף = 40 g of the 100 g = 20 נק׳ row
    expect(back.pointsBasis).toBe("reference:estimated_conversion");
    expect(convertibleUnits(hummusSpoon, index.groupsByKey.get("חומוס"), () => false)).toContain(
      "גרם",
    );
  });

  it("4b. evidence too rounded to divide is not evidence", () => {
    // Real case from the dataset this rule came from — דבש, where 100 גרם = 9 נק׳:
    //   1 כף   = 2 נק׳ → 22.2 g (true ≈ 21 g)  — usable
    //   1 כפית = 1 נק׳ → 11.1 g (true ≈ 7 g)   — 59% out, and nothing else to
    // compare it against, because one count row against one weight row always
    // "agrees" with itself. So the pair's own rounding noise decides.
    const thinSpoon = item("ממרח", 1, { family: "count", primary: count(1, "כפית") });
    const thinWeight = item("ממרח", 9, weight(100));
    const thin = buildReferenceIndex({
      source: { id: "t", version: "t1", fileName: "t", sha256: "t", sheet: "t" },
      items: [thinSpoon, thinWeight],
    });
    expect(referenceEstimateForUnit(thin.groupsByKey.get("ממרח")!, "כפית").kind).toBe(
      "insufficient",
    );
    // and the scorer refuses rather than inventing a weight
    const s = scoreDetails(measured(thinSpoon.id, 30, "גרם"), undefined, { reference: thin });
    expect(s.pointsValue).toBeNull();
    expect(s.pointsBasis).toBe("reference:blocked");
  });

  it("5. inconsistent siblings refuse inference; a manual bridge then works", () => {
    expect(referenceEstimateForUnit(index.groupsByKey.get("ריבה")!, "כף").kind).toBe(
      "inconsistent",
    );
    const blocked = scoreDetails(measured(jamSpoon.id, 30, "גרם"), undefined, { reference: index });
    expect(blocked.pointsValue).toBeNull();
    expect(blocked.pointsBasis).toBe("reference:blocked");
    const bridge: WeightBridge = {
      id: "b",
      sourceKind: "reference",
      sourceKey: "ריבה",
      unit: "כף",
      gramsPerUnit: 15,
      provenance: "user_measured",
    };
    const bridged = scoreDetails(measured(jamSpoon.id, 30, "גרם"), undefined, {
      reference: index,
      bridges: buildBridgeIndex([bridge]),
    });
    expect(bridged.pointsValue).toBe(4);
    expect(bridged.pointsBasis).toBe("reference:bridged");
  });

  it("6. an explicit bridge wins over a weaker inferred estimate", () => {
    const bridge: WeightBridge = {
      id: "b2",
      sourceKind: "reference",
      sourceKey: "חומוס",
      unit: "כף",
      gramsPerUnit: 30,
      provenance: "label",
    };
    const s = scoreDetails(measured(hummusSpoon.id, 60, "גרם"), undefined, {
      reference: index,
      bridges: buildBridgeIndex([bridge]),
    });
    // The bridge says 30 g per כף, so 60 g is 2 כף × 4 נק׳ = 8. Inference would
    // have said 20 g per כף and therefore 12, so the number itself proves which
    // one was used.
    expect(s.pointsValue).toBe(8);
    expect(s.basisSnapshot?.conversion).toMatchObject({ kind: "bridge", gramsPerUnit: 30 });
  });

  it("7. no leakage across foods / variants, no evidence from review rows", () => {
    // חומוס לייט is its own group: it must not use חומוס's 20 g/כף
    const light = scoreDetails(measured(hummusLight.id, 60, "גרם"), undefined, {
      reference: index,
    });
    expect(light.pointsValue).toBeNull();
    // a bridge for חומוס does not apply to חומוס לייט
    const bridge: WeightBridge = {
      id: "b3",
      sourceKind: "reference",
      sourceKey: "חומוס",
      unit: "כף",
      gramsPerUnit: 20,
      provenance: "label",
    };
    expect(
      scoreDetails(measured(hummusLight.id, 60, "גרם"), undefined, {
        reference: index,
        bridges: buildBridgeIndex([bridge]),
      }).pointsValue,
    ).toBeNull();
    expect(referenceEstimateForUnit(index.groupsByKey.get("לחם")!, "פרוסה").kind).toBe("none");
    expect(
      scoreDetails(measured(cookie.id, 40, "גרם"), undefined, { reference: index }).pointsValue,
    ).toBeNull();
  });
});

describe("DEC-038 calculated products", () => {
  const soup: CalculatedProduct = buildCalculatedProduct({
    id: "soup",
    name: "מרק עוף",
    revision: 1,
    totalPoints: 52,
    totalWeightG: 2000,
  });

  it("1. 52 points / 2000 g → 1000 g = 26, 300 g scales deterministically", () => {
    expect(soup.pointsPerGram).toBe(0.026);
    // RAW, before any rounding: this is the basis the acceptance contract names.
    expect(calculatedRawPoints(soup, 1000)).toBe(26);
    expect(calculatedRawPoints(soup, 500)).toBe(13);
    expect(calculatedRawPoints(soup, 300)).toBeCloseTo(7.8, 10);
    // Rounding happens at the meal-log boundary and nowhere earlier.
    expect(calculatedServingPoints(soup, 1000)).toBe(26);
    expect(calculatedServingPoints(soup, 500)).toBe(13);
    expect(calculatedServingPoints(soup, 300)).toBe(8); // 7.8 → 8 at the meal boundary
    const s = scoreDetails(
      {
        mode: "measured",
        amount: 300,
        unit: "גרם",
        calculatedProductId: "soup",
      },
      undefined,
      { calculatedProducts: new Map([["soup", soup]]) },
    );
    expect(s.pointsValue).toBe(8);
    expect(s.pointsBasis).toBe("calculated:weighed");
    expect(s.basisSnapshot?.calculated).toMatchObject({ totalPoints: 52, totalWeightG: 2000 });
  });

  it("2. kg and g entry are equivalent", () => {
    const g = validateCalculatedInput({
      name: "מרק",
      totalPoints: 52,
      totalWeight: 2000,
      weightUnit: "גרם",
    });
    const kg = validateCalculatedInput({
      name: "מרק",
      totalPoints: 52,
      totalWeight: 2,
      weightUnit: "ק״ג",
    });
    expect(g).toEqual(kg);
    expect(g.ok && g.pointsPerGram).toBe(0.026);
    const ctx = { calculatedProducts: new Map([["soup", soup]]) };
    const base = {
      foodId: "soup",
      foodName: "מרק",
      mode: "measured" as const,
      calculatedProductId: "soup",
    };
    expect(scoreDetails({ ...base, amount: 0.3, unit: "ק״ג" }, undefined, ctx).pointsValue).toBe(
      scoreDetails({ ...base, amount: 300, unit: "גרם" }, undefined, ctx).pointsValue,
    );
    expect(
      validateCalculatedInput({ name: "x", totalPoints: 5, totalWeight: 0, weightUnit: "גרם" }).ok,
    ).toBe(false);
    expect(
      validateCalculatedInput({
        name: "x",
        totalPoints: Number.NaN,
        totalWeight: 5,
        weightUnit: "גרם",
      }).ok,
    ).toBe(false);
  });

  it("history: a saved snapshot is untouched when the product is edited", () => {
    const saved = scoreEntry(
      {
        id: "e1",
        foodId: "soup",
        foodName: "מרק",
        mode: "measured" as const,
        amount: 1000,
        unit: "גרם" as const,
        calculatedProductId: "soup",
      },
      undefined,
      { calculatedProducts: new Map([["soup", soup]]) },
    );
    const edited = buildCalculatedProduct({
      id: "soup",
      name: "מרק עוף",
      revision: 2,
      totalPoints: 80,
      totalWeightG: 2000,
    });
    // nothing re-reads the product for an already-saved entry
    expect(saved.pointsValue).toBe(26);
    expect(saved.calculatedRevision).toBe(1);
    expect(saved.basisSnapshot?.calculated?.totalPoints).toBe(52);
    expect(edited.pointsPerGram).toBe(0.04);
  });

  it("a non-weight unit is refused, never guessed", () => {
    const s = scoreDetails(
      {
        mode: "measured",
        amount: 1,
        unit: "קערה",
        calculatedProductId: "soup",
      },
      undefined,
      { calculatedProducts: new Map([["soup", soup]]) },
    );
    expect(s.pointsValue).toBeNull();
    expect(s.pointsBasis).toBe("calculated:blocked");
  });
});
