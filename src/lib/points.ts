/**
 * Points engine. Since DEC-036 (2026-09-22) the ONLY source of a new points
 * value is the canonical points reference (`points-reference/`): a chosen
 * reference row, scaled safely within its unit family, or nothing. There is no
 * category / model / manual fallback any more — an entry that cannot be
 * resolved is saved UNSCORED (`pointsValue` null, basis `unscored:*`) and shown
 * as such, never estimated.
 *
 * Snapshots: an entry carries `pointsValue` + `pointsModelVersion` + basis as
 * saved when it was logged/edited. Display always prefers the persisted
 * snapshot; a snapshot is never recalculated in place — only a deliberate
 * edit (store.updateEntry) re-scores, and only through the reference.
 *
 * The v1 / v2-il model functions below are kept as deprecated explainers of
 * historical snapshots and for the personalised daily budget (unchanged).
 */
import type {
  BasisSnapshot,
  CalculatedProduct,
  DayData,
  Dish,
  EstimatedProduct,
  Food,
  FoodEntry,
  SubjectiveAmount,
  Unit,
} from "./domain";
import {
  convertQuantity,
  sourceExplicitConversion,
  applyBenefit,
  benefitEligibility,
  coffeeReferenceGroup,
  getReferenceIndex,
  resolveReferenceItem,
  selectableItems,
  type ReferenceIndex,
  type Resolution,
} from "./points-reference";
import { dishServingPoints } from "./dishes";
import { calculatedBasisOf, calculatedServingPoints, toGrams } from "./calculated-products";
import { estimatedPointsForGrams } from "./label-estimator";
import { findBridge, resolveGrams, type BridgeIndex } from "./weight-bridges";
import {
  BUDGET_V2,
  CATEGORY_PORTION_POINTS_V2,
  COUNT_UNIT_PORTIONS,
  MIN_NONZERO_ENTRY_POINTS,
  NUTRITION_WEIGHTS_V2,
  POINTS_MODEL_V1,
  POINTS_MODEL_V2,
  POINTS_ROUNDING_STEP,
  STANDARD_PORTION_GRAMS,
  STANDARD_PORTION_ML,
  SUBJECTIVE_MULTIPLIER_V2,
  UNIT_FAMILY,
  UNIT_TO_GRAMS,
  UNIT_TO_ML,
  UNKNOWN_FOOD_PORTION_POINTS,
  ZERO_POINT_CATEGORIES,
} from "./points-config";

export { POINTS_MODEL_V1, POINTS_MODEL_V2, SUBJECTIVE_LABEL } from "./points-config";

/** The model used for every NEW or deliberately edited snapshot. */
export const POINTS_MODEL_VERSION = POINTS_MODEL_V2;

/**
 * Optional real nutrition facts per serving of a food. Never fabricated: a
 * food without facts falls back to its category. Ready for a future catalog
 * that carries them.
 */
export interface NutritionFacts {
  calories: number;
  proteinG?: number;
  fiberG?: number;
  saturatedFatG?: number;
  addedSugarG?: number;
  unsaturatedFatG?: number;
  /** The serving these facts describe, in the food's own unit. */
  servingAmount: number;
  servingUnit: Unit;
}

type EntryQuantity = Pick<FoodEntry, "mode" | "amount" | "unit" | "subjective">;

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export const roundHalf = (value: number): number => roundTo(value, 0.5);

// --- portions ------------------------------------------------------------------

/**
 * How many STANDARD PORTIONS an entry represents. Weight/volume units scale
 * against the standard portion mass/volume; count/serving units are portions
 * (a slice, a cup, a unit) with their own fraction; subjective levels are
 * multipliers of one portion.
 */
export function portionsForEntry(entry: EntryQuantity): number {
  if (entry.mode === "subjective") {
    return entry.subjective ? SUBJECTIVE_MULTIPLIER_V2[entry.subjective] : 1;
  }
  const amount = Number(entry.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const unit = entry.unit as Unit | undefined;
  if (!unit) return amount;
  switch (UNIT_FAMILY[unit]) {
    case "weight":
      return (amount * (UNIT_TO_GRAMS[unit] ?? 1)) / STANDARD_PORTION_GRAMS;
    case "volume":
      return (amount * (UNIT_TO_ML[unit] ?? 1)) / STANDARD_PORTION_ML;
    default:
      return amount * (COUNT_UNIT_PORTIONS[unit as keyof typeof COUNT_UNIT_PORTIONS] ?? 1);
  }
}

// --- per-portion value (hierarchy) ---------------------------------------------

export type PointsBasis = "zero" | "calibrated" | "nutrition" | "category" | "unknown";

/** @deprecated DEC-034 model — kept to explain historical v2-il snapshots only (DEC-036). */
export function portionPointsForFood(food?: Food): { points: number; basis: PointsBasis } {
  if (!food) return { points: UNKNOWN_FOOD_PORTION_POINTS, basis: "unknown" };
  if (food.kind === "coffee") return { points: 0, basis: "zero" };
  if (food.category && ZERO_POINT_CATEGORIES.has(food.category))
    return { points: 0, basis: "zero" };
  if (food.pointsPerPortion != null && Number.isFinite(food.pointsPerPortion)) {
    return { points: Math.max(0, food.pointsPerPortion), basis: "calibrated" };
  }
  if (food.nutrition) return { points: pointsFromNutrition(food.nutrition), basis: "nutrition" };
  if (food.category && food.category in CATEGORY_PORTION_POINTS_V2) {
    return {
      points: CATEGORY_PORTION_POINTS_V2[food.category as keyof typeof CATEGORY_PORTION_POINTS_V2],
      basis: "category",
    };
  }
  return { points: UNKNOWN_FOOD_PORTION_POINTS, basis: "unknown" };
}

/** Transparent linear score of REAL facts, normalised to one standard portion. */
export function pointsFromNutrition(n: NutritionFacts): number {
  const w = NUTRITION_WEIGHTS_V2;
  const perServing =
    n.calories * w.perCalorie +
    (n.saturatedFatG ?? 0) * w.perSaturatedFatG +
    (n.addedSugarG ?? 0) * w.perAddedSugarG +
    (n.proteinG ?? 0) * w.perProteinG +
    (n.fiberG ?? 0) * w.perFiberG +
    (n.unsaturatedFatG ?? 0) * w.perUnsaturatedFatG;
  const servingPortions = portionsForEntry({
    mode: "measured",
    amount: n.servingAmount,
    unit: n.servingUnit,
  });
  const perPortion = servingPortions > 0 ? perServing / servingPortions : perServing;
  return Math.max(0, perPortion);
}

// --- entry scoring --------------------------------------------------------------

/** @deprecated DEC-034 model — explains historical v2-il snapshots only; never used for new values (DEC-036). */
export function calculatePointsV2(
  entry: EntryQuantity & { coffee?: unknown },
  food?: Food,
): number {
  if (entry.coffee || food?.kind === "coffee") return 0;
  const { points } = portionPointsForFood(food);
  if (points === 0) return 0;
  const portions = portionsForEntry(entry);
  if (portions <= 0) return 0;
  return Math.max(MIN_NONZERO_ENTRY_POINTS, roundTo(points * portions, POINTS_ROUNDING_STEP));
}

export type ScoreBasis =
  | "reference:exact"
  | "reference:scaled"
  | "reference:any"
  | "reference:blocked"
  // DEC-037 — derived sources, always distinguishable from a canonical value.
  | "dish:weighed"
  | "dish:estimated"
  | "estimated:label"
  | "estimated:blocked"
  // DEC-038 — manually calculated product; reference quantities reached
  // through a stored bridge or an estimate from the reference itself.
  | "calculated:weighed"
  | "calculated:estimated"
  | "calculated:blocked"
  | "reference:bridged"
  | "reference:estimated_conversion"
  | "unscored:no_reference"
  | "unscored:ambiguous";

/**
 * True when the POINTS were estimated from a nutrition label instead of read
 * from the canonical reference.
 *
 * `dish:weighed` / `dish:estimated` are deliberately NOT included: a dish
 * basis records how the served WEIGHT was obtained, not how the dish was
 * scored. A dish's points are an estimate only when it contains an estimated
 * ingredient — a property of the dish (`Dish.hasEstimated`), which the UI
 * shows separately.
 */
export function isEstimatedBasis(basis: string | undefined): boolean {
  return basis === "estimated:label";
}

export interface ScoreContext {
  reference?: ReferenceIndex;
  /** Entries already logged on the same profile-day (benefit eligibility). */
  dayEntries?: Array<{ id: string; benefitRule?: FoodEntry["benefitRule"] }>;
  /** DEC-037 — dishes by id (a serving scores from the dish's points/gram). */
  dishes?: Map<string, Dish>;
  /** DEC-037 — label-estimated products by id. */
  estimatedProducts?: Map<string, EstimatedProduct>;
  /** DEC-037 — explicit gram bridges, for estimated products logged by a non-weight unit. */
  bridges?: BridgeIndex;
  /** DEC-038 — manually calculated products by id. */
  calculatedProducts?: Map<string, CalculatedProduct>;
}

type ScorableEntry = EntryQuantity &
  Partial<
    Pick<
      FoodEntry,
      | "id"
      | "coffee"
      | "referenceItemId"
      | "benefitRule"
      | "dishId"
      | "dishRevision"
      | "estimatedProductId"
      | "consumedWeightG"
      | "weightSource"
      | "calculatedProductId"
      | "calculatedRevision"
    >
  >;

export interface Scored {
  /** null = unscored: no reference row could be resolved; never estimated. */
  pointsValue: number | null;
  pointsModelVersion: string;
  pointsBasis: ScoreBasis;
  basePoints: number | null;
  referenceItemId?: string;
  benefitRule?: FoodEntry["benefitRule"];
  /** DEC-038 — always present (possibly undefined) so a re-score clears a stale one. */
  basisSnapshot?: BasisSnapshot;
  calculatedRevision?: number;
}

/** Model version stamped on every reference-based snapshot (DEC-036). */
export const POINTS_MODEL_REFERENCE = "ref-v1" as const;

function toRequested(entry: EntryQuantity) {
  return entry.mode === "subjective"
    ? ({ mode: "subjective", subjective: entry.subjective ?? "במידה" } as const)
    : ({ mode: "measured", amount: Number(entry.amount ?? 0), unit: entry.unit as Unit } as const);
}

function unscored(
  basis:
    | "reference:blocked"
    | "estimated:blocked"
    | "calculated:blocked"
    | "unscored:no_reference"
    | "unscored:ambiguous",
  referenceItemId?: string,
): Scored {
  const out: Scored = {
    pointsValue: null,
    pointsModelVersion: POINTS_MODEL_REFERENCE,
    pointsBasis: basis,
    basePoints: null,
    basisSnapshot: undefined,
  };
  if (referenceItemId) out.referenceItemId = referenceItemId;
  return out;
}

/**
 * Where the points of an entry come from (DEC-036): the chosen reference row
 * (exact / scaled / any), or the single selectable row of the food's reference
 * group, or — for the coffee editor — the reference row the milk choice maps
 * to. Nothing else. Ambiguity (several rows, none chosen) and unsafe
 * conversions are never resolved silently: the result is unscored / blocked
 * and the UI must ask.
 */
export function scoreDetails(entry: ScorableEntry, food?: Food, ctx: ScoreContext = {}): Scored {
  const index = ctx.reference ?? getReferenceIndex();
  const requested = toRequested(entry);

  // 1. DEC-037 — a serving of a household dish: points/gram × consumed grams.
  //    The dish revision is recorded so the snapshot stays explainable after
  //    the dish is edited (the dish itself is never re-read for a saved entry).
  if (entry.dishId) {
    const dish = ctx.dishes?.get(entry.dishId);
    const grams = Number(entry.consumedWeightG ?? entry.amount ?? 0);
    if (!dish || !Number.isFinite(grams) || grams <= 0) {
      return unscored("unscored:no_reference");
    }
    const points = dishServingPoints(dish.pointsPerGram, grams);
    return {
      pointsValue: points,
      pointsModelVersion: POINTS_MODEL_REFERENCE,
      pointsBasis: entry.weightSource === "estimated" ? "dish:estimated" : "dish:weighed",
      basePoints: points,
      basisSnapshot: undefined,
    };
  }

  // 2. DEC-037 — a label-estimated product: per-100 g estimate × grams. A
  //    non-weight unit needs an explicit bridge of that product; never guessed.
  if (entry.estimatedProductId) {
    const product = ctx.estimatedProducts?.get(entry.estimatedProductId);
    if (!product) return unscored("unscored:no_reference");
    const unit = entry.unit as Unit | undefined;
    const amount = Number(entry.amount ?? 0);
    if (entry.mode !== "measured" || !unit || !Number.isFinite(amount) || amount <= 0) {
      return unscored("estimated:blocked");
    }
    const resolution = resolveGrams(
      ctx.bridges ?? new Map(),
      { kind: "estimated", key: product.id },
      amount,
      unit,
    );
    if (resolution.kind !== "weight" && resolution.kind !== "bridged") {
      return unscored("estimated:blocked");
    }
    const points = estimatedPointsForGrams(product.pointsPer100g, resolution.grams);
    return {
      pointsValue: points,
      pointsModelVersion: POINTS_MODEL_REFERENCE,
      pointsBasis: "estimated:label",
      basePoints: points,
      basisSnapshot: undefined,
    };
  }

  // 3. DEC-038 — a manually calculated product: points/gram × grams. Weight
  //    units only. The basis actually used is copied into the entry, so an
  //    edit of the product can never change this meal.
  if (entry.calculatedProductId) {
    const product = ctx.calculatedProducts?.get(entry.calculatedProductId);
    if (!product) return unscored("unscored:no_reference");
    const grams =
      entry.mode === "measured" ? toGrams(Number(entry.amount ?? 0), entry.unit as Unit) : null;
    if (grams == null) return unscored("calculated:blocked");
    const points = calculatedServingPoints(product, grams);
    return {
      pointsValue: points,
      pointsModelVersion: POINTS_MODEL_REFERENCE,
      pointsBasis:
        entry.weightSource === "estimated" ? "calculated:estimated" : "calculated:weighed",
      basePoints: points,
      calculatedRevision: product.revision,
      basisSnapshot: { calculated: calculatedBasisOf(product) },
    };
  }

  let item = entry.referenceItemId ? index.itemsById.get(entry.referenceItemId) : undefined;
  if (!item && (entry.coffee || food?.kind === "coffee")) {
    if (!entry.coffee) return unscored("unscored:no_reference");
    const group = coffeeReferenceGroup(index, entry.coffee);
    if (!group) return unscored("unscored:no_reference");
    const rows = selectableItems(group);
    if (rows.length !== 1) return unscored("unscored:ambiguous");
    item = rows[0];
  }
  if (!item && food?.referenceGroupKey) {
    const group = index.groupsByKey.get(food.referenceGroupKey);
    const rows = group ? selectableItems(group) : [];
    if (rows.length === 1) item = rows[0];
    else if (rows.length > 1) return unscored("unscored:ambiguous");
  }
  if (!item) return unscored("unscored:no_reference");

  let r: Resolution = resolveReferenceItem(item, requested);
  let basis: ScoreBasis = `reference:${r.kind}` as ScoreBasis;
  let basisSnapshot: BasisSnapshot | undefined;
  if (r.kind !== "blocked" && requested.mode === "measured") {
    const explicit = sourceExplicitConversion(item, requested.unit);
    if (explicit) basisSnapshot = { conversion: explicit };
  }
  // DEC-038 — the engine refused a cross-family quantity: try a stored bridge
  // of this reference food, then a coherent estimate from the same group.
  if ((r.kind === "blocked" || r.points == null) && requested.mode === "measured") {
    const group = index.groupsByKey.get(item.normalizedName);
    const bridgeFor = (unit: Unit) =>
      group
        ? findBridge(ctx.bridges ?? new Map(), { kind: "reference", key: group.key }, unit)
        : undefined;
    const converted = convertQuantity(item, group, requested, bridgeFor);
    if (converted.kind === "converted") {
      const viaConversion = resolveReferenceItem(item, {
        mode: "measured",
        amount: converted.amount,
        unit: converted.unit,
      });
      if (viaConversion.kind !== "blocked" && viaConversion.points != null) {
        r = viaConversion;
        basis =
          converted.conversion.kind === "bridge"
            ? "reference:bridged"
            : "reference:estimated_conversion";
        basisSnapshot = { conversion: converted.conversion };
      }
    }
  }
  if (r.kind === "blocked" || r.points == null) return unscored("reference:blocked", item.id);
  const benefit = item.benefits?.find((b) => b.rule === entry.benefitRule);
  const eligibility =
    benefit && benefit.rule !== "zero_any_quantity"
      ? benefitEligibility(benefit.rule, ctx.dayEntries ?? [], entry.id)
      : undefined;
  const applied = applyBenefit(r.points, benefit, eligibility);
  const scored: Scored = {
    pointsValue: applied.appliedPoints,
    pointsModelVersion: POINTS_MODEL_REFERENCE,
    pointsBasis: basis,
    basePoints: applied.basePoints,
    referenceItemId: item.id,
    basisSnapshot,
  };
  if (applied.benefitRule) scored.benefitRule = applied.benefitRule;
  return scored;
}

/** True when the entry can be saved with a real reference value. */
export function isScored(scored: Pick<Scored, "pointsValue">): boolean {
  return scored.pointsValue != null && Number.isFinite(scored.pointsValue);
}

/** The snapshot to persist for a new or deliberately edited entry. */
export function scoreEntry<T extends ScorableEntry>(
  entry: T,
  food?: Food,
  ctx: ScoreContext = {},
): T & Scored {
  return { ...entry, ...scoreDetails(entry, food, ctx) };
}

/**
 * Display value: the persisted snapshot always wins (whatever its version).
 * Entries logged before any points model get a v2-il estimate for display
 * only — nothing is written back.
 */
/**
 * Display value: the persisted snapshot always wins (whatever its version);
 * an entry without a snapshot is UNSCORED (null) — never estimated (DEC-036).
 * `_food` is kept for call-site compatibility.
 */
export function pointsForEntry(entry: FoodEntry, _food?: Food): number | null {
  if (entry.pointsValue != null && Number.isFinite(entry.pointsValue)) {
    return Math.max(0, entry.pointsValue);
  }
  return null;
}

/** Sum of the scored entries of a day (unscored entries are excluded, see `unscoredEntries`). */
export function pointsForDay(day: DayData, _foods: Food[] = []): number {
  let total = 0;
  for (const meal of Object.values(day.meals)) {
    for (const entry of meal.entries) total += pointsForEntry(entry) ?? 0;
  }
  return roundHalf(total);
}

/** Entries of a day that carry no points value (shown as "ללא ניקוד"). */
export function unscoredEntries(day: DayData): FoodEntry[] {
  const out: FoodEntry[] = [];
  for (const meal of Object.values(day.meals)) {
    for (const entry of meal.entries) if (pointsForEntry(entry) == null) out.push(entry);
  }
  return out;
}

/** Remaining points against a configured target; null when there is no target. */
export function pointsRemaining(total: number, budget: number | null): number | null {
  if (budget == null || !Number.isFinite(budget)) return null;
  return roundHalf(budget - total);
}

export function formatPoints(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = roundHalf(value);
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toLocaleString("he-IL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// --- legacy v1 (kept only so historical snapshots can be explained/tested) ---------

const V1_CATEGORY_BASE: Record<string, number> = {
  "ירקות ועשבי תיבול": 0,
  פירות: 0,
  "מוצרי חלב ותחליפים": 2,
  ביצים: 2,
  "לחם ומאפים": 3,
  "דגנים ופחמימות": 4,
  קטניות: 3,
  "עוף ובשר": 4,
  דגים: 3,
  "מנות ותבשילים": 5,
  "אגוזים, גרעינים וממרחים": 4,
  "חטיפים ומתוקים": 6,
  משקאות: 2,
  "רטבים, שמנים ותבלינים": 3,
};
const V1_SUBJECTIVE: Record<SubjectiveAmount, number> = { מעט: 0.5, במידה: 1, הרבה: 1.5, מוגזם: 2 };

/** @deprecated v1 — never used for new snapshots; retained for legacy reasoning. */
export function calculatePointsV1(
  entry: EntryQuantity & { coffee?: unknown },
  food?: Food,
): number {
  if (entry.coffee || food?.kind === "coffee") return 0;
  const base = !food?.category ? 4 : (V1_CATEGORY_BASE[food.category] ?? 4);
  if (base === 0) return 0;
  let factor: number;
  if (entry.mode === "subjective") factor = entry.subjective ? V1_SUBJECTIVE[entry.subjective] : 1;
  else {
    const amount = Math.max(0, Number(entry.amount ?? 0));
    switch (entry.unit as Unit | undefined) {
      case "גרם":
        factor = amount / 100;
        break;
      case "ק״ג":
        factor = amount * 10;
        break;
      case "מ״ל":
        factor = amount / 250;
        break;
      case "ליטר":
        factor = amount * 4;
        break;
      case "חצי יחידה":
        factor = amount * 0.5;
        break;
      default:
        factor = amount;
    }
  }
  if (factor <= 0) return 0;
  return Math.max(0.5, roundHalf(base * factor));
}

// --- personalised daily budget ---------------------------------------------------

export type SexAtBirth = "male" | "female";
export type GoalMode = "lose" | "maintain";

/** What the budget needs to know about a person (stored on the profile). */
export interface ProfileFacts {
  sexAtBirth?: SexAtBirth | null;
  birthDate?: string | null; // yyyy-mm-dd
  heightCm?: number | null;
  goalMode?: GoalMode | null;
  pointsBudgetOverride?: number | null;
}

/** Whole years between a birth date and `today` (both yyyy-mm-dd or Date). */
export function ageFromBirthDate(birthDate: string, today: Date | string = new Date()): number {
  const b = new Date(birthDate + (birthDate.length === 10 ? "T00:00:00" : ""));
  const t = typeof today === "string" ? new Date(today + "T00:00:00") : today;
  let age = t.getFullYear() - b.getFullYear();
  const beforeBirthday =
    t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(0, age);
}

/** Mifflin-St Jeor resting energy expenditure (public equation). */
export function mifflinStJeorBmr(input: {
  sexAtBirth: SexAtBirth;
  age: number;
  heightCm: number;
  weightKg: number;
}): number {
  const m = BUDGET_V2.MIFFLIN;
  return (
    m.weight * input.weightKg +
    m.height * input.heightCm -
    m.age * input.age +
    (input.sexAtBirth === "male" ? m.male : m.female)
  );
}

/**
 * @deprecated DEC-037 — NOT part of the active target path. The daily target is
 * manual only; this stays as the documented seam (and its tests) for the future
 * sex+weight lookup table, which will replace `resolvePointsBudget`'s body.
 *
 * Weight-loss budget = REFERENCE_DAILY_POINTS scaled by BMR / REFERENCE_BMR,
 * clamped to the product range; maintenance applies the documented uplift.
 */
export function calculatePersonalizedPointsBudget(input: {
  sexAtBirth: SexAtBirth;
  age: number;
  heightCm: number;
  weightKg: number;
  goalMode: GoalMode;
}): number {
  const c = BUDGET_V2;
  const bmr = mifflinStJeorBmr(input);
  const raw = c.REFERENCE_DAILY_POINTS * (bmr / c.REFERENCE_BMR);
  const loss = Math.min(c.MAX_DAILY_POINTS, Math.max(c.MIN_DAILY_POINTS, raw));
  const scaled = input.goalMode === "maintain" ? loss * c.MAINTENANCE_UPLIFT : loss;
  return roundTo(scaled, c.ROUNDING_STEP);
}

/**
 * DEC-037: the daily target is MANUAL only. "manual" = the person entered it;
 * "none" = no target is configured, which is a real, first-class state — the
 * app never invents one.
 */
export type BudgetSource = "manual" | "none";
export type MissingFact = "sex" | "birthDate" | "height" | "weight";

export interface BudgetInfo {
  /** null = no target configured. Never a fallback / automatic number. */
  budget: number | null;
  source: BudgetSource;
  /**
   * Kept for the future sex+weight lookup seam (out of scope): which body
   * facts are still missing. It has NO effect on the active target.
   */
  missing: MissingFact[];
}

/**
 * Effective daily budget for a profile: manual override wins; else personalised
 * from the facts + latest weight; else the documented fallback. Never blocks.
 */
export function resolvePointsBudget(
  facts: ProfileFacts | undefined,
  latestWeightKg?: number | undefined,
  _today: Date | string = new Date(),
): BudgetInfo {
  // The manually entered per-profile target is the ONLY source (DEC-037). The
  // body facts and the latest weigh-in are stored and displayed, but they can
  // never become the active target — no BMR, no fallback 23/30. The future
  // sex+weight lookup table replaces the body of THIS function and nothing else.
  const manual = facts?.pointsBudgetOverride;
  const missing: MissingFact[] = [];
  if (!facts?.sexAtBirth) missing.push("sex");
  if (!facts?.birthDate) missing.push("birthDate");
  if (!facts?.heightCm || facts.heightCm <= 0) missing.push("height");
  if (!latestWeightKg || latestWeightKg <= 0) missing.push("weight");
  if (manual != null && Number.isFinite(manual) && manual > 0) {
    return { budget: manual, source: "manual", missing };
  }
  return { budget: null, source: "none", missing };
}

/** Latest valid weigh-in (by date, then time) of a profile, or undefined. */
export function latestWeightKg(
  weighIns: { dateISO: string; time?: string; weightKg: number }[],
): number | undefined {
  let best: { dateISO: string; time?: string; weightKg: number } | undefined;
  for (const w of weighIns) {
    if (!Number.isFinite(w.weightKg) || w.weightKg <= 0) continue;
    const key = `${w.dateISO} ${w.time ?? "00:00"}`;
    const bestKey = best ? `${best.dateISO} ${best.time ?? "00:00"}` : "";
    if (!best || key >= bestKey) best = w;
  }
  return best?.weightKg;
}
