/**
 * Dishes (DEC-037) — pure calculation.
 *
 * A dish is a household recipe made of ingredients that each keep their own
 * provenance: a canonical reference row (DEC-036 rules unchanged) or a
 * label-estimated product (`label-estimate-v1`). The dish is logged by WEIGHT:
 *
 *   total_dish_points = Σ ingredient_points
 *   points_per_gram   = total_dish_points / final_prepared_weight_g
 *   logged_points     = points_per_gram × consumed_weight_g
 *
 * The rate keeps full precision; the half-point convention of the app is
 * applied only where a value is persisted on a meal entry.
 *
 * Nothing here guesses: a gram amount of a reference ingredient whose portion
 * is not weight-based resolves only through an EXPLICIT bridge of that exact
 * reference identity (`weight-bridges.ts`), otherwise the ingredient is
 * blocked and the UI must ask for the bridge.
 */
import type {
  CalculatedProduct,
  Dish,
  DishIngredient,
  EstimatedProduct,
  Unit,
  WeightBridge,
} from "./domain";
import {
  calculatedBasisOf,
  calculatedRawPoints,
  describeCalculatedBasis,
  toGrams,
} from "./calculated-products";
import { estimatedPointsForGrams } from "./label-estimator";
import { roundHalf } from "./points";
import {
  convertQuantity,
  formatPortion,
  getReferenceIndex,
  resolveReferenceItem,
  type ReferencePortion,
  type ReferenceRuntimeItem,
  type Resolution,
} from "./points-reference";
import { STANDARD_PORTION_GRAMS } from "./points-config";
import {
  bridgeSnapshot,
  findBridge,
  gramsFromWeightUnit,
  isWeightUnit,
  type BridgeIndex,
} from "./weight-bridges";

/** What the person is adding to the dish, before it is resolved to points. */
export type IngredientRequest =
  | {
      sourceKind: "reference";
      item: ReferenceRuntimeItem;
      /** Display name of the reference food (the group name). */
      name: string;
      groupKey: string;
      sourceVersion?: string;
      amount: number;
      unit: Unit;
    }
  | {
      sourceKind: "estimated";
      product: EstimatedProduct;
      amount: number;
      unit: Unit;
    }
  | {
      // DEC-038 — a manually calculated product, weight units only.
      sourceKind: "calculated";
      product: CalculatedProduct;
      amount: number;
      unit: Unit;
    };

export type IngredientBlockReason =
  | "invalid_amount"
  | "needs_bridge"
  | "unit_not_supported"
  | "status_not_active";

export type IngredientResolution =
  | { ok: true; ingredient: DishIngredient }
  | {
      ok: false;
      reason: IngredientBlockReason;
      /** The unit a bridge is needed FOR (the unit the person typed). */
      unit?: Unit;
      /** The reference unit the bridge should be stated in ("1 כף = ? גרם"). */
      bridgeUnit?: Unit;
    };

/**
 * Resolves one ingredient to points + an immutable snapshot.
 *
 * Reference ingredients, in order:
 *  1. the quantity resolves directly against the reference portion (the
 *     unchanged DEC-036 engine: gram↔gram, ml↔ml, same count label);
 *  2. the person weighed it but the portion is not weight-based → an explicit
 *     bridge for that reference identity converts grams into the portion's own
 *     unit, and the reference engine scores that;
 *  3. otherwise blocked.
 */
export function resolveIngredient(
  request: IngredientRequest,
  bridges: BridgeIndex,
): IngredientResolution {
  const amount = Number(request.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: "invalid_amount" };

  if (request.sourceKind === "calculated") {
    const grams = toGrams(amount, request.unit);
    if (grams == null) return { ok: false, reason: "unit_not_supported", unit: request.unit };
    const p = request.product;
    return {
      ok: true,
      ingredient: {
        sourceKind: "calculated",
        name: p.name,
        calculatedProductId: p.id,
        calculatedBasis: calculatedBasisOf(p),
        amount,
        unit: request.unit,
        basisText: describeCalculatedBasis(p),
        gramsUsed: grams,
        // Full precision inside the dish; only the logged serving rounds.
        points: calculatedRawPoints(p, grams),
      },
    };
  }

  if (request.sourceKind === "estimated") {
    const source = { kind: "estimated" as const, key: request.product.id };
    if (isWeightUnit(request.unit)) {
      const grams = gramsFromWeightUnit(amount, request.unit);
      return {
        ok: true,
        ingredient: estimatedIngredient(request.product, amount, request.unit, grams),
      };
    }
    const bridge = findBridge(bridges, source, request.unit);
    if (!bridge)
      return { ok: false, reason: "needs_bridge", unit: request.unit, bridgeUnit: request.unit };
    const grams = amount * bridge.gramsPerUnit;
    return {
      ok: true,
      ingredient: estimatedIngredient(request.product, amount, request.unit, grams, bridge),
    };
  }

  const { item } = request;
  if (item.status !== "active") return { ok: false, reason: "status_not_active" };

  // 1. direct — the reference engine decides, exactly as it does for a meal entry.
  const direct = resolveReferenceItem(item, { mode: "measured", amount, unit: request.unit });
  if (direct.kind !== "blocked" && direct.points != null) {
    const grams = isWeightUnit(request.unit)
      ? gramsFromWeightUnit(amount, request.unit)
      : gramsFromResolution(item.portion, direct);
    return {
      ok: true,
      ingredient: referenceIngredient(request, amount, request.unit, direct.points, grams),
    };
  }

  // 2. DEC-038 — a cross-family quantity: a stored bridge of this reference
  //    food first, then a coherent estimate from the SAME reference group.
  //    Never another food / variant. The conversion used is snapshotted.
  const portionUnit = item.portion?.primary?.appUnit as Unit | undefined;
  const group = getReferenceIndex().groupsByKey.get(request.groupKey);
  const source = { kind: "reference" as const, key: request.groupKey };
  const converted = convertQuantity(
    item,
    group,
    { amount, unit: request.unit },
    (unit) => findBridge(bridges, source, unit),
  );
  if (converted.kind === "converted") {
    const via = resolveReferenceItem(item, {
      mode: "measured",
      amount: converted.amount,
      unit: converted.unit,
    });
    if (via.kind !== "blocked" && via.points != null) {
      const grams = isWeightUnit(request.unit)
        ? gramsFromWeightUnit(amount, request.unit)
        : amount * converted.conversion.gramsPerUnit;
      const bridge =
        converted.conversion.kind === "bridge"
          ? findBridge(bridges, source, converted.conversion.unit)
          : undefined;
      const ingredient = referenceIngredient(request, amount, request.unit, via.points, grams, bridge);
      ingredient.conversion = converted.conversion;
      return { ok: true, ingredient };
    }
    return { ok: false, reason: "unit_not_supported", unit: request.unit };
  }
  if (converted.kind === "blocked" && converted.bridgeUnit) {
    return {
      ok: false,
      reason: "needs_bridge",
      unit: request.unit,
      bridgeUnit: converted.bridgeUnit,
    };
  }

  return { ok: false, reason: "needs_bridge", unit: request.unit, bridgeUnit: portionUnit };
    }
    const grams = gramsFromWeightUnit(amount, request.unit);
    const units = grams / bridge.gramsPerUnit;
    const viaBridge = resolveReferenceItem(item, {
      mode: "measured",
      amount: units,
      unit: portionUnit,
    });
    if (viaBridge.kind === "blocked" || viaBridge.points == null) {
      return { ok: false, reason: "unit_not_supported", unit: request.unit };
    }
    return {
      ok: true,
      ingredient: referenceIngredient(
        request,
        amount,
        request.unit,
        viaBridge.points,
        grams,
        bridge,
      ),
    };
  }

  return { ok: false, reason: "needs_bridge", unit: request.unit, bridgeUnit: portionUnit };
}

/**
 * Grams for a NON-weight amount of a reference portion, derived from the very
 * scale the reference engine used plus the portion's explicit gram
 * equivalence. Taking the scale from the engine means the measure that
 * actually matched decides — a count stated in an alternative measure
 * ("1 כף / 3 כפיות") is no longer scaled by the primary measure's amount.
 *
 * Returns undefined rather than a guess when the portion states no grams, or
 * for a "0 at any quantity" portion whose scale is a constant 1. The points
 * are unaffected either way: they always come from the engine. Grams are only
 * carried in the snapshot (and, for an estimated ingredient, are the basis).
 */
function gramsFromResolution(
  portion: ReferencePortion | null | undefined,
  resolution: Resolution,
): number | undefined {
  if (!portion || portion.family === "any" || portion.grams == null) return undefined;
  const scale = resolution.scale;
  if (scale == null || !Number.isFinite(scale) || scale <= 0) return undefined;
  return scale * portion.grams;
}

function referenceIngredient(
  request: Extract<IngredientRequest, { sourceKind: "reference" }>,
  amount: number,
  unit: Unit,
  points: number,
  gramsUsed?: number,
  bridge?: WeightBridge,
): DishIngredient {
  const ingredient: DishIngredient = {
    sourceKind: "reference",
    name: request.name,
    referenceItemId: request.item.id,
    referenceGroupKey: request.groupKey,
    amount,
    unit,
    basisText: formatPortion(request.item.portion),
    points,
  };
  if (request.sourceVersion) ingredient.sourceVersion = request.sourceVersion;
  if (gramsUsed != null) ingredient.gramsUsed = gramsUsed;
  if (bridge) ingredient.bridge = bridgeSnapshot(bridge);
  return ingredient;
}

function estimatedIngredient(
  product: EstimatedProduct,
  amount: number,
  unit: Unit,
  grams: number,
  bridge?: WeightBridge,
): DishIngredient {
  const ingredient: DishIngredient = {
    sourceKind: "estimated",
    name: product.name,
    estimatedProductId: product.id,
    estimatorVersion: product.estimatorVersion,
    amount,
    unit,
    basisText: `${STANDARD_PORTION_GRAMS} גרם = ${formatRate(product.pointsPer100g)} נק׳`,
    gramsUsed: grams,
    points: estimatedPointsForGrams(product.pointsPer100g, grams),
  };
  if (bridge) ingredient.bridge = bridgeSnapshot(bridge);
  return ingredient;
}

function formatRate(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString("he-IL");
}

// --- dish totals ---------------------------------------------------------------

export interface DishTotals {
  totalPoints: number;
  pointsPerGram: number;
  hasEstimatedIngredient: boolean;
}

/**
 * Dish totals. The sum keeps the ingredient values as they were resolved; the
 * rate keeps full precision so a small serving is not distorted by rounding.
 */
export function dishTotals(ingredients: DishIngredient[], finalWeightG: number): DishTotals {
  const totalPoints = ingredients.reduce((sum, i) => sum + (Number(i.points) || 0), 0);
  const weight = Number(finalWeightG);
  const pointsPerGram = Number.isFinite(weight) && weight > 0 ? totalPoints / weight : 0;
  return {
    totalPoints,
    pointsPerGram,
    hasEstimatedIngredient: ingredients.some((i) => i.sourceKind === "estimated"),
  };
}

/** Points for a served weight of a dish — the persisted/logged boundary. */
export function dishServingPoints(pointsPerGram: number, consumedWeightG: number): number {
  const grams = Number(consumedWeightG);
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  if (!Number.isFinite(pointsPerGram) || pointsPerGram <= 0) return 0;
  const raw = pointsPerGram * grams;
  return Math.max(0.5, roundHalf(raw));
}

/** Assembles the current definition of a dish (the store persists it + a version row). */
export function buildDish(input: {
  id: string;
  name: string;
  revision: number;
  ingredients: DishIngredient[];
  finalWeightG: number;
  usualServingWeightG?: number;
  createdBy?: Dish["createdBy"];
  /** Preserved across an edit: editing an archived dish must not un-archive it. */
  isActive?: boolean;
}): Dish {
  const totals = dishTotals(input.ingredients, input.finalWeightG);
  const dish: Dish = {
    id: input.id,
    name: input.name.trim(),
    revision: input.revision,
    ingredients: input.ingredients,
    totalPoints: totals.totalPoints,
    finalWeightG: input.finalWeightG,
    pointsPerGram: totals.pointsPerGram,
    isActive: input.isActive ?? true,
    hasEstimatedIngredient: totals.hasEstimatedIngredient,
  };
  if (input.usualServingWeightG != null) dish.usualServingWeightG = input.usualServingWeightG;
  if (input.createdBy) dish.createdBy = input.createdBy;
  return dish;
}

/** "3.4 נק׳ ל-100 גרם" — the compact rate line used in lists. */
export function formatPointsPerGram(pointsPerGram: number): string {
  const per100 = pointsPerGram * STANDARD_PORTION_GRAMS;
  const rounded = Math.round(per100 * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toLocaleString("he-IL")} נק׳ ל-${STANDARD_PORTION_GRAMS} גרם`;
}
