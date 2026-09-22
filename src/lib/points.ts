/**
 * Internal points engine (DEC-034, model "v2-il"). Pure and cheap; every
 * constant lives in `points-config.ts`.
 *
 * Calculation hierarchy for a food:
 *   1. explicit calibrated value per standard portion (`food.pointsPerPortion`);
 *   2. real nutrition facts (`food.nutrition`) → transparent linear score;
 *   3. category fallback (`CATEGORY_PORTION_POINTS_V2`).
 * Vegetables are 0 at any quantity; coffee is 0 (its own editor).
 *
 * Snapshots: an entry carries `pointsValue` + `pointsModelVersion` as saved
 * when it was logged/edited. Display always prefers the persisted snapshot;
 * legacy "v1" snapshots are never recalculated in place — an entry moves to
 * v2-il only when the person deliberately edits it (store.updateEntry).
 */
import type { DayData, Food, FoodEntry, SubjectiveAmount, Unit } from "./domain";
import {
  applyBenefit,
  benefitEligibility,
  getReferenceIndex,
  resolvePortion,
  resolveReferenceItem,
  type ReferenceIndex,
  type ReferencePortion,
  type Resolution,
} from "./points-reference";
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

/** Points for ONE standard portion of a food and where that number came from. */
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

/** v2-il score for an entry's CURRENT quantity. */
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
  | "custom:confirmed"
  | "custom:blocked"
  | "model:v2-il"
  | "zero:coffee";

export interface ScoreContext {
  reference?: ReferenceIndex;
  /** Entries already logged on the same profile-day (benefit eligibility). */
  dayEntries?: Array<{ id: string; benefitRule?: FoodEntry["benefitRule"] }>;
}

type ScorableEntry = EntryQuantity &
  Partial<Pick<FoodEntry, "id" | "coffee" | "referenceItemId" | "benefitRule">>;

export interface Scored {
  pointsValue: number;
  pointsModelVersion: string;
  pointsBasis: ScoreBasis;
  basePoints: number;
  referenceItemId?: string;
  benefitRule?: FoodEntry["benefitRule"];
}

function toRequested(entry: EntryQuantity) {
  return entry.mode === "subjective"
    ? ({ mode: "subjective", subjective: entry.subjective ?? "במידה" } as const)
    : ({ mode: "measured", amount: Number(entry.amount ?? 0), unit: entry.unit as Unit } as const);
}

function blocked(basis: "reference:blocked" | "custom:blocked", referenceItemId?: string): Scored {
  const out: Scored = {
    pointsValue: 0,
    pointsModelVersion: POINTS_MODEL_V2,
    pointsBasis: basis,
    basePoints: 0,
  };
  if (referenceItemId) out.referenceItemId = referenceItemId;
  return out;
}

/**
 * Where the points of an entry come from (DEC-035 precedence):
 *   1. the chosen reference row (exact / scaled / any) — never a different row;
 *   2. a custom food with a confirmed portion value, scaled the same safe way;
 *   3. the internal v2-il model for foods that are neither (built-in catalog
 *      foods without a reference match keep their DEC-034 behaviour).
 * A reference-linked entry whose quantity cannot be converted safely is
 * "blocked": nothing is invented, the UI must ask for a resolvable unit.
 */
export function scoreDetails(entry: ScorableEntry, food?: Food, ctx: ScoreContext = {}): Scored {
  if (entry.coffee || food?.kind === "coffee") {
    return {
      pointsValue: 0,
      pointsModelVersion: POINTS_MODEL_V2,
      pointsBasis: "zero:coffee",
      basePoints: 0,
    };
  }
  const index = ctx.reference ?? getReferenceIndex();
  const requested = toRequested(entry);

  // 1. explicit reference row (chosen variation) or the single row of the linked group
  let item = entry.referenceItemId ? index.itemsById.get(entry.referenceItemId) : undefined;
  if (!item && food?.referenceGroupKey) {
    const group = index.groupsByKey.get(food.referenceGroupKey);
    if (group?.items.length === 1) item = group.items[0];
  }
  if (item) {
    const r: Resolution = resolveReferenceItem(item, requested);
    if (r.kind === "blocked" || r.points == null) return blocked("reference:blocked", item.id);
    const benefit = item.benefits?.find((b) => b.rule === entry.benefitRule);
    const eligibility =
      benefit && benefit.rule !== "zero_any_quantity"
        ? benefitEligibility(benefit.rule, ctx.dayEntries ?? [], entry.id)
        : undefined;
    const applied = applyBenefit(r.points, benefit, eligibility);
    const scored: Scored = {
      pointsValue: applied.appliedPoints,
      pointsModelVersion: POINTS_MODEL_V2,
      pointsBasis: `reference:${r.kind}` as ScoreBasis,
      basePoints: applied.basePoints,
      referenceItemId: item.id,
    };
    if (applied.benefitRule) scored.benefitRule = applied.benefitRule;
    return scored;
  }
  // Linked to a group with several variations but none chosen → ambiguous,
  // and ambiguity is never resolved silently.
  if (food?.referenceGroupKey && food.pointsStatus !== "confirmed") {
    return blocked("reference:blocked");
  }

  // 2. custom food with a confirmed portion value
  if (food?.pointsStatus === "confirmed" && food.pointsPerPortion != null) {
    const r = resolvePortion(customPortion(food), food.pointsPerPortion, requested);
    if (r.kind === "blocked" || r.points == null) return blocked("custom:blocked");
    return {
      pointsValue: r.points,
      pointsModelVersion: POINTS_MODEL_V2,
      pointsBasis: "custom:confirmed",
      basePoints: r.points,
    };
  }

  // 3. internal model
  const v2 = calculatePointsV2(entry, food);
  return {
    pointsValue: v2,
    pointsModelVersion: POINTS_MODEL_V2,
    pointsBasis: "model:v2-il",
    basePoints: v2,
  };
}

/** A custom food's confirmed portion expressed as a reference-style portion. */
export function customPortion(
  food: Pick<Food, "portionAmount" | "portionUnit" | "defaultUnit">,
): ReferencePortion {
  const amount = food.portionAmount ?? 1;
  const unit = (food.portionUnit ?? food.defaultUnit ?? "יחידה") as Unit;
  const family = UNIT_FAMILY[unit];
  const text = `${amount} ${unit}`;
  if (family === "weight") {
    const grams = amount * (UNIT_TO_GRAMS[unit] ?? 1);
    return {
      text,
      family: "weight",
      primary: { amount: grams, family: "weight", label: "גרם", appUnit: "גרם" },
      grams,
    };
  }
  if (family === "volume") {
    const ml = amount * (UNIT_TO_ML[unit] ?? 1);
    return {
      text,
      family: "volume",
      primary: { amount: ml, family: "volume", label: "מ״ל", appUnit: "מ״ל" },
      ml,
    };
  }
  return {
    text,
    family: "count",
    primary: { amount, family: "count", label: unit, appUnit: unit },
  };
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
export function pointsForEntry(entry: FoodEntry, food?: Food): number {
  if (entry.pointsValue != null && Number.isFinite(entry.pointsValue)) {
    return Math.max(0, entry.pointsValue);
  }
  // A reference-linked entry without a snapshot is never estimated from the
  // internal model — that would invent a number the reference refused.
  if (entry.referenceItemId || entry.pointsBasis?.startsWith("reference:")) return 0;
  return calculatePointsV2(entry, food);
}

export function pointsForDay(day: DayData, foods: Food[]): number {
  const byId = new Map(foods.map((f) => [f.id, f]));
  let total = 0;
  for (const meal of Object.values(day.meals)) {
    for (const entry of meal.entries) total += pointsForEntry(entry, byId.get(entry.foodId));
  }
  return roundHalf(total);
}

export function pointsRemaining(total: number, budget: number): number {
  return roundHalf(budget - total);
}

export function formatPoints(value: number): string {
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
 * The ONE budget function. Weight-loss budget = REFERENCE_DAILY_POINTS scaled by
 * BMR / REFERENCE_BMR, clamped to the product range; maintenance applies the
 * documented uplift. Rounded to the configured step. Not the WW equation.
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

export type BudgetSource = "override" | "personalized" | "fallback";
export type MissingFact = "sex" | "birthDate" | "height" | "weight";

export interface BudgetInfo {
  budget: number;
  source: BudgetSource;
  /** Facts still needed for a personalised budget (empty when personalised). */
  missing: MissingFact[];
}

/**
 * Effective daily budget for a profile: manual override wins; else personalised
 * from the facts + latest weight; else the documented fallback. Never blocks.
 */
export function resolvePointsBudget(
  facts: ProfileFacts | undefined,
  latestWeightKg: number | undefined,
  today: Date | string = new Date(),
): BudgetInfo {
  const override = facts?.pointsBudgetOverride;
  if (override != null && Number.isFinite(override) && override > 0) {
    return { budget: override, source: "override", missing: [] };
  }
  const missing: MissingFact[] = [];
  if (!facts?.sexAtBirth) missing.push("sex");
  if (!facts?.birthDate) missing.push("birthDate");
  if (!facts?.heightCm || facts.heightCm <= 0) missing.push("height");
  if (!latestWeightKg || latestWeightKg <= 0) missing.push("weight");
  if (missing.length > 0)
    return { budget: BUDGET_V2.FALLBACK_DAILY_POINTS, source: "fallback", missing };
  return {
    budget: calculatePersonalizedPointsBudget({
      sexAtBirth: facts!.sexAtBirth!,
      age: ageFromBirthDate(facts!.birthDate!, today),
      heightCm: facts!.heightCm!,
      weightKg: latestWeightKg!,
      goalMode: facts!.goalMode ?? "lose",
    }),
    source: "personalized",
    missing: [],
  };
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
