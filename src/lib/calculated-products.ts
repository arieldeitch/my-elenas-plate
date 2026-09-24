/**
 * Manually calculated products (DEC-038) — pure calculation.
 *
 * The person worked the TOTAL points out elsewhere (an external calculator, a
 * recipe app) and knows the total prepared weight:
 *
 *   points_per_gram = total_points / total_weight_g     (full precision)
 *   logged_points   = points_per_gram × consumed_grams  (rounded at the meal
 *                                                        boundary only, exactly
 *                                                        like a dish serving)
 *
 * Nothing is inferred. Only weight units are accepted, so there is never a
 * conversion to explain.
 */
import type { CalculatedBasis, CalculatedProduct, Unit } from "./domain";
import { dishServingPoints } from "./dishes";

export const CALCULATED_METHOD_VERSION = "external-calc-v1";

/** Human-readable source label (never the internal method id). */
export const CALCULATED_SOURCE_LABEL = "חישוב חיצוני";

export type WeightInputUnit = "גרם" | "ק״ג";

export function toGrams(amount: number, unit: WeightInputUnit | Unit): number | null {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === "גרם") return n;
  if (unit === "ק״ג") return n * 1000;
  return null;
}

export type CalculatedValidation =
  | { ok: true; totalPoints: number; totalWeightG: number; pointsPerGram: number }
  | { ok: false; field: "name" | "points" | "weight"; message: string };

export function validateCalculatedInput(input: {
  name: string;
  totalPoints: number;
  totalWeight: number;
  weightUnit: WeightInputUnit;
}): CalculatedValidation {
  if (!input.name.trim()) return { ok: false, field: "name", message: "יש לתת שם למוצר" };
  const points = Number(input.totalPoints);
  if (!Number.isFinite(points) || points < 0) {
    return { ok: false, field: "points", message: "יש להזין סך נקודות (0 ומעלה)" };
  }
  const grams = toGrams(input.totalWeight, input.weightUnit);
  if (grams == null) {
    return { ok: false, field: "weight", message: "יש להזין משקל כולל חיובי" };
  }
  return { ok: true, totalPoints: points, totalWeightG: grams, pointsPerGram: points / grams };
}

export function buildCalculatedProduct(input: {
  id: string;
  name: string;
  revision: number;
  totalPoints: number;
  totalWeightG: number;
  createdBy?: CalculatedProduct["createdBy"];
  isActive?: boolean;
}): CalculatedProduct {
  const product: CalculatedProduct = {
    id: input.id,
    name: input.name.trim(),
    revision: input.revision,
    totalPoints: input.totalPoints,
    totalWeightG: input.totalWeightG,
    pointsPerGram: input.totalPoints / input.totalWeightG,
    methodVersion: CALCULATED_METHOD_VERSION,
    isActive: input.isActive ?? true,
  };
  if (input.createdBy) product.createdBy = input.createdBy;
  return product;
}

/** Unrounded points for a weight (used inside a dish, where only the total rounds). */
export function calculatedRawPoints(product: Pick<CalculatedProduct, "pointsPerGram">, grams: number) {
  return product.pointsPerGram * grams;
}

/** Points for a serving, rounded with the meal-entry convention. */
export function calculatedServingPoints(
  product: Pick<CalculatedProduct, "pointsPerGram">,
  grams: number,
): number {
  if (product.pointsPerGram === 0 && Number.isFinite(grams) && grams > 0) return 0;
  return dishServingPoints(product.pointsPerGram, grams);
}

export function calculatedBasisOf(product: CalculatedProduct): CalculatedBasis {
  return {
    revision: product.revision,
    totalPoints: product.totalPoints,
    totalWeightG: product.totalWeightG,
    pointsPerGram: product.pointsPerGram,
    methodVersion: product.methodVersion,
  };
}

/** "52 נק׳ ל-2000 גרם" — the one-line explanation of the stored basis. */
export function describeCalculatedBasis(
  basis: Pick<CalculatedBasis, "totalPoints" | "totalWeightG">,
): string {
  const w = basis.totalWeightG;
  const weight = w >= 1000 && w % 100 === 0 ? `${w / 1000} ק״ג` : `${w} גרם`;
  return `${basis.totalPoints} נק׳ ל-${weight}`;
}
