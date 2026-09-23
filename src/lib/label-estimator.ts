/**
 * Label estimator (DEC-037, model `label-estimate-v1`).
 *
 * A product that is NOT in the canonical reference (DEC-036) can still be
 * logged — but only from values the person typed off its package, and only as
 * a clearly marked ESTIMATE. Nothing is fabricated: an optional value the
 * label does not show stays absent and simply contributes nothing.
 *
 * The maths is the app's existing transparent linear model
 * (`pointsFromNutrition` + `NUTRITION_WEIGHTS_V2`), not a new black box and not
 * a claim about any proprietary formula. DEC-036 deprecated that model as a
 * CANONICAL fallback; this module re-authorises it only inside this separate
 * estimated layer (see `docs/adr/ADR-2026-09-23-dishes-bridges-estimated.md`).
 *
 * Normalisation is deterministic:
 *   per_100g    → the values are already the 100 g basis;
 *   per_serving → value × 100 / servingWeightG.
 */
import type { LabelInput } from "./domain";
import { STANDARD_PORTION_GRAMS } from "./points-config";
import { pointsFromNutrition, roundHalf, type NutritionFacts } from "./points";

export const LABEL_ESTIMATOR_VERSION = "label-estimate-v1" as const;

/** Hebrew label shown wherever an estimated value appears. */
export const ESTIMATED_LABEL = "הערכה לפי ערכים תזונתיים";
/** Short form for compact rows / chips. */
export const ESTIMATED_SHORT = "הערכה";

export type LabelError =
  | "calories_missing"
  | "calories_invalid"
  | "serving_weight_required"
  | "serving_weight_invalid"
  | "negative_value";

/** Validates a label input the way the form does (pure, reusable in tests). */
export function validateLabel(input: Partial<LabelInput>): LabelError[] {
  const errors: LabelError[] = [];
  if (input.calories == null || String(input.calories).trim() === "") {
    errors.push("calories_missing");
  } else if (!Number.isFinite(Number(input.calories)) || Number(input.calories) < 0) {
    errors.push("calories_invalid");
  }
  if (input.basis === "per_serving") {
    if (input.servingWeightG == null) errors.push("serving_weight_required");
    else if (!Number.isFinite(input.servingWeightG) || input.servingWeightG <= 0) {
      errors.push("serving_weight_invalid");
    }
  }
  for (const key of [
    "proteinG",
    "fiberG",
    "saturatedFatG",
    "addedSugarG",
    "unsaturatedFatG",
  ] as const) {
    const v = input[key];
    if (v != null && (!Number.isFinite(v) || v < 0)) errors.push("negative_value");
  }
  return errors;
}

const OPTIONAL_KEYS = [
  "proteinG",
  "fiberG",
  "saturatedFatG",
  "addedSugarG",
  "unsaturatedFatG",
] as const;

/**
 * The label values expressed per 100 g. Absent optional values stay absent —
 * they are NOT turned into a measured zero (the difference matters when the
 * stored facts are read back or re-estimated later).
 */
export function normalizeLabelTo100g(input: LabelInput): NutritionFacts {
  const factor =
    input.basis === "per_100g" ? 1 : STANDARD_PORTION_GRAMS / (input.servingWeightG as number);
  const facts: NutritionFacts = {
    calories: input.calories * factor,
    servingAmount: STANDARD_PORTION_GRAMS,
    servingUnit: "גרם",
  };
  for (const key of OPTIONAL_KEYS) {
    const value = input[key];
    if (value != null) facts[key] = value * factor;
  }
  return facts;
}

export interface LabelEstimate {
  /** Full-precision points for 100 g; rounded only at the logging boundary. */
  pointsPer100g: number;
  /** The normalised facts the value was computed from (persisted for audit). */
  facts: NutritionFacts;
  version: typeof LABEL_ESTIMATOR_VERSION;
}

/**
 * Deterministic points estimate for a labelled product, per 100 g.
 * `pointsFromNutrition` normalises to one standard portion, and the standard
 * portion IS 100 g, so its result is exactly the per-100 g value.
 */
export function estimateFromLabel(input: LabelInput): LabelEstimate {
  const facts = normalizeLabelTo100g(input);
  return {
    pointsPer100g: Math.max(0, pointsFromNutrition(facts)),
    facts,
    version: LABEL_ESTIMATOR_VERSION,
  };
}

/** Points for a weight of an estimated product (half-point display/log precision). */
export function estimatedPointsForGrams(pointsPer100g: number, grams: number): number {
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  const raw = (pointsPer100g * grams) / STANDARD_PORTION_GRAMS;
  return raw === 0 ? 0 : Math.max(0.5, roundHalf(raw));
}

/** One-line explanation of what the estimate was based on (UI + audit). */
export function describeLabelBasis(input: LabelInput): string {
  return input.basis === "per_100g" ? "לפי 100 גרם" : `לפי מנה של ${input.servingWeightG} גרם`;
}
