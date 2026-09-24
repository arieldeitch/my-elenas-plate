/**
 * Reference unit conversions (DEC-038). Pure.
 *
 * DEC-036 blocks cross-family scaling (grams against a "1 כף" portion). That
 * stays the default. This module opens it only where the evidence is safe,
 * in this order of strength:
 *
 *   1. source_explicit — the reference cell itself states the weight
 *      ("1 כף / 15 גרם"). The engine already scales by `portion.grams`; this
 *      module only labels it.
 *   2. bridge — a stored "1 <unit> = N גרם" fact for THIS reference food
 *      (package label / measured by us). Stronger than any inference.
 *   3. reference_estimate ("הערכה מהמאגר") — the SAME reference food (same
 *      normalized name = same group; never an alias, brand, variant or
 *      raw/cooked sibling, which are different groups) has a count row and a
 *      weight row. Points per unit ÷ points per gram gives grams per unit.
 *      Only active rows with no rule and at least 1 point are evidence (a
 *      half-point row carries up to ±50 % rounding noise). If the pairwise
 *      estimates disagree by more than INFERENCE_TOLERANCE, nothing is
 *      guessed.
 *   4. otherwise blocked — the UI offers the explicit bridge form.
 */
import type { ConversionSnapshot, Unit, WeightBridge } from "../domain";
import { POINTS_ROUNDING_STEP, UNIT_FAMILY, UNIT_TO_GRAMS } from "../points-config";
import type { ReferencePortion, ReferenceRuntimeItem } from "./types";

/** Max relative spread (max/min − 1) between sibling estimates. */
export const INFERENCE_TOLERANCE = 0.15;
/** Minimum points of an evidence row (rounding-noise guard). */
export const MIN_EVIDENCE_POINTS = 1;
/**
 * Published points are rounded to POINTS_ROUNDING_STEP, so a row stating p
 * points really means p ± STEP/2. Dividing one such row by another multiplies
 * that noise: grams-per-unit derived from a 1-point row can be out by a
 * quarter before anything else goes wrong. Real example from the dataset —
 * דבש, where 100 g = 9 points is the weight row:
 *
 *   1 כף  = 2 points → 22.2 g/כף   (true ≈ 21 g, so ~6% out)   uncertainty 0.15
 *   1 כפית = 1 point  → 11.1 g/כפית (true ≈ 7 g,  so ~59% out)  uncertainty 0.28
 *
 * The spread check cannot catch the second one, because a single count row
 * against a single weight row yields exactly one estimate and therefore
 * "agrees" with itself. So each pair carries its own uncertainty and a pair
 * that is too noisy is not evidence at all.
 */
export const MAX_ESTIMATE_UNCERTAINTY = 0.2;

/** Relative uncertainty a published points value carries from half-point rounding. */
function pointsUncertainty(points: number): number {
  return points > 0 ? POINTS_ROUNDING_STEP / 2 / points : Number.POSITIVE_INFINITY;
}

export const CONVERSION_LABEL: Record<ConversionSnapshot["kind"], string> = {
  source_explicit: "לפי המאגר · המרה מפורשת במאגר",
  bridge: "לפי המאגר · המרה שנשמרה",
  reference_estimate: "הערכה מהמאגר",
};

/**
 * What the person reads under a converted quantity. An inferred conversion says
 * so ("הערכה מהמאגר"); a weight stated in the reference cell itself, or one the
 * household measured, must never wear that label — they are facts, not guesses.
 */
export function describeConversion(conversion: ConversionSnapshot): string {
  const rate = `1 ${conversion.unit} ≈ ${formatGrams(conversion.gramsPerUnit)} גרם`;
  return conversion.kind === "reference_estimate"
    ? `${CONVERSION_LABEL.reference_estimate} · ${rate}`
    : `${CONVERSION_LABEL[conversion.kind]} · 1 ${conversion.unit} = ${formatGrams(conversion.gramsPerUnit)} גרם`;
}

function formatGrams(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Minimal group shape (avoids importing the index module). */
export interface ConversionGroup {
  key: string;
  items: ReferenceRuntimeItem[];
}

export type EstimateResult =
  | { kind: "ok"; gramsPerUnit: number; evidenceRows: number[] }
  | { kind: "none" }
  /** Evidence exists but is too rounded to derive a weight from. */
  | { kind: "insufficient" }
  | { kind: "inconsistent"; estimates: number[] };

function isWeight(unit: Unit): boolean {
  return UNIT_FAMILY[unit] === "weight";
}

function countMeasure(portion: ReferencePortion | null, unit: Unit) {
  if (!portion) return undefined;
  return [portion.primary, ...(portion.alternatives ?? [])].find(
    (m) => !!m && m.family === "count" && m.appUnit === unit && m.amount > 0,
  );
}

/** Grams per ONE `unit` stated in the same cell ("1 כף / 15 גרם"), else null. */
export function explicitGramsPerUnit(item: ReferenceRuntimeItem, unit: Unit): number | null {
  const m = countMeasure(item.portion, unit);
  if (!m || item.portion?.grams == null || item.portion.grams <= 0) return null;
  return item.portion.grams / m.amount;
}

function isEvidence(item: ReferenceRuntimeItem): boolean {
  return (
    item.status === "active" &&
    item.rule == null &&
    !item.benefitOf &&
    item.points >= MIN_EVIDENCE_POINTS &&
    !!item.portion &&
    item.portion.family !== "any"
  );
}

/**
 * Grams per ONE `unit` derived from the rows of ONE reference group.
 * Evidence: same-cell explicit rows (direct), and count×weight row pairs.
 */
export function referenceEstimateForUnit(group: ConversionGroup, unit: Unit): EstimateResult {
  if (isWeight(unit)) return { kind: "none" };
  const rows = group.items.filter(isEvidence);
  const estimates: Array<{ value: number; rows: number[] }> = [];
  const countRows: Array<{ ppu: number; row: number; points: number }> = [];
  const weightRows: Array<{ ppg: number; row: number; points: number }> = [];
  for (const item of rows) {
    const explicit = explicitGramsPerUnit(item, unit);
    if (explicit != null) {
      // Stated in the cell itself — a fact, not a ratio, so no rounding noise.
      estimates.push({ value: explicit, rows: [item.sourceRow] });
      continue;
    }
    const m = countMeasure(item.portion, unit);
    if (m && item.portion?.grams == null)
      countRows.push({ ppu: item.points / m.amount, row: item.sourceRow, points: item.points });
    if (item.portion?.grams != null && item.portion.grams > 0) {
      weightRows.push({
        ppg: item.points / item.portion.grams,
        row: item.sourceRow,
        points: item.points,
      });
    }
  }
  let noisyPairs = 0;
  for (const c of countRows) {
    for (const w of weightRows) {
      if (pointsUncertainty(c.points) + pointsUncertainty(w.points) > MAX_ESTIMATE_UNCERTAINTY) {
        noisyPairs += 1;
        continue;
      }
      estimates.push({ value: c.ppu / w.ppg, rows: [c.row, w.row] });
    }
  }
  if (estimates.length === 0) return noisyPairs > 0 ? { kind: "insufficient" } : { kind: "none" };
  const values = estimates.map((e) => e.value).sort((a, b) => a - b);
  if (values[values.length - 1] / values[0] - 1 > INFERENCE_TOLERANCE) {
    return { kind: "inconsistent", estimates: values };
  }
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  const evidenceRows = [...new Set(estimates.flatMap((e) => e.rows))].sort((a, b) => a - b);
  return { kind: "ok", gramsPerUnit: Math.round(median * 100) / 100, evidenceRows };
}

export type ConversionOutcome =
  | {
      kind: "converted";
      /** The quantity to hand to the unchanged reference engine. */
      amount: number;
      unit: Unit;
      conversion: ConversionSnapshot;
    }
  | {
      kind: "blocked";
      reason: "no_evidence" | "inconsistent" | "insufficient_evidence" | "not_applicable";
      /** The count unit a bridge would be stated in ("1 כף = ? גרם"). */
      bridgeUnit?: Unit;
    };

/**
 * Converts a measured quantity that the engine refused into the item's own
 * terms, using bridge → reference estimate. The caller has already tried the
 * engine directly (which covers the same-cell explicit case).
 */
export function convertQuantity(
  item: ReferenceRuntimeItem,
  group: ConversionGroup | undefined,
  quantity: { amount: number; unit: Unit },
  bridgeFor: (unit: Unit) => WeightBridge | undefined,
): ConversionOutcome {
  const portion = item.portion;
  if (!portion || portion.family === "any" || item.status !== "active") {
    return { kind: "blocked", reason: "not_applicable" };
  }
  const amount = Number(quantity.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { kind: "blocked", reason: "not_applicable" };

  const gramsPerUnitFor = (
    unit: Unit,
  ):
    | { snapshot: ConversionSnapshot }
    | { blocked: "no_evidence" | "inconsistent" | "insufficient_evidence" } => {
    const bridge = bridgeFor(unit);
    if (bridge) {
      return {
        snapshot: {
          kind: "bridge",
          unit,
          gramsPerUnit: bridge.gramsPerUnit,
          provenance: bridge.provenance,
        },
      };
    }
    if (!group) return { blocked: "no_evidence" };
    const est = referenceEstimateForUnit(group, unit);
    if (est.kind === "ok") {
      return {
        snapshot: {
          kind: "reference_estimate",
          unit,
          gramsPerUnit: est.gramsPerUnit,
          evidenceRows: est.evidenceRows,
        },
      };
    }
    if (est.kind === "inconsistent") return { blocked: "inconsistent" };
    return { blocked: est.kind === "insufficient" ? "insufficient_evidence" : "no_evidence" };
  };

  // A. grams against a count portion without a stated weight.
  if (isWeight(quantity.unit) && portion.grams == null) {
    const p = portion.primary;
    if (!p || p.family !== "count" || !p.appUnit)
      return { kind: "blocked", reason: "not_applicable" };
    const unit = p.appUnit as Unit;
    const found = gramsPerUnitFor(unit);
    if ("blocked" in found) return { kind: "blocked", reason: found.blocked, bridgeUnit: unit };
    const grams = amount * (UNIT_TO_GRAMS[quantity.unit] ?? 1);
    return {
      kind: "converted",
      amount: grams / found.snapshot.gramsPerUnit,
      unit,
      conversion: found.snapshot,
    };
  }

  // B. a count unit against a weight-based portion that does not list that unit.
  if (!isWeight(quantity.unit) && UNIT_FAMILY[quantity.unit] === "count" && portion.grams != null) {
    if (countMeasure(portion, quantity.unit)) return { kind: "blocked", reason: "not_applicable" };
    const found = gramsPerUnitFor(quantity.unit);
    if ("blocked" in found) {
      return { kind: "blocked", reason: found.blocked, bridgeUnit: quantity.unit };
    }
    return {
      kind: "converted",
      amount: amount * found.snapshot.gramsPerUnit,
      unit: "גרם",
      conversion: found.snapshot,
    };
  }

  return { kind: "blocked", reason: "not_applicable" };
}

/** The same-cell equivalence the engine used for a weight request, if any. */
export function sourceExplicitConversion(
  item: ReferenceRuntimeItem,
  requestUnit: Unit,
): ConversionSnapshot | undefined {
  const p = item.portion?.primary;
  if (!isWeight(requestUnit) || !p || p.family !== "count" || !p.appUnit) return undefined;
  const g = explicitGramsPerUnit(item, p.appUnit as Unit);
  return g == null
    ? undefined
    : { kind: "source_explicit", unit: p.appUnit as Unit, gramsPerUnit: g };
}

/** Units a group can resolve once bridges / estimates are considered. */
export function convertibleUnits(
  item: ReferenceRuntimeItem,
  group: ConversionGroup | undefined,
  hasBridge: (unit: Unit) => boolean,
): Unit[] {
  const portion = item.portion;
  if (!portion || portion.family === "any") return [];
  const out: Unit[] = [];
  const p = portion.primary;
  if (portion.grams == null && p?.family === "count" && p.appUnit) {
    const u = p.appUnit as Unit;
    const ok = hasBridge(u) || (group && referenceEstimateForUnit(group, u).kind === "ok");
    if (ok) out.push("גרם", "ק״ג");
  }
  if (portion.grams != null && group) {
    for (const other of group.items) {
      for (const m of [other.portion?.primary, ...(other.portion?.alternatives ?? [])]) {
        const u = m?.appUnit as Unit | undefined;
        if (!u || m?.family !== "count" || out.includes(u) || countMeasure(portion, u)) continue;
        if (hasBridge(u) || referenceEstimateForUnit(group, u).kind === "ok") out.push(u);
      }
    }
  }
  return out;
}
