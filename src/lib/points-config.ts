/**
 * Points model v2-il — THE ONE place for every scoring and budget constant.
 *
 * The model is inspired by the public principles of Weight Watchers / the
 * historical Israeli "שומרי משקל" system (simple per-food values, preferable
 * foods cost less, a personalised daily allowance derived from the body). It is
 * NOT the proprietary WW formula and never claims to be. Everything here is a
 * transparent, versioned, behavioural scoring parameter — not nutrition advice.
 *
 * Deliberate product overrides (DEC-034):
 *  - vegetables are ALWAYS 0 at any quantity;
 *  - fruit is a low POSITIVE value (older Israeli model), never free.
 *
 * Elena's experiential calibration ("this used to feel like ~1 / 1.5 / 3")
 * changes numbers here, nothing else.
 */
import type { SubjectiveAmount, Unit } from "./domain";
import type { FoodCategory } from "../data/foods/types";

export const POINTS_MODEL_V2 = "v2-il" as const;
export const POINTS_MODEL_V1 = "v1" as const;

// ---------------------------------------------------------------------------
// Category fallback (used when a food has neither a calibrated portion value
// nor real nutrition facts). Points PER STANDARD PORTION of the food.
// Relative order follows the WW-like philosophy: vegetables 0 → fruit low →
// lean protein / legumes / fish low → dairy, eggs, grains, breads medium →
// spreads, nuts, dishes higher → sweets, snacks, sugary drinks, rich sauces highest.
// ---------------------------------------------------------------------------
export const CATEGORY_PORTION_POINTS_V2: Record<FoodCategory, number> = {
  "ירקות ועשבי תיבול": 0,
  פירות: 1,
  דגים: 2,
  קטניות: 2,
  "עוף ובשר": 3,
  ביצים: 2,
  "מוצרי חלב ותחליפים": 2,
  "דגנים ופחמימות": 3,
  "לחם ומאפים": 3,
  "אגוזים, גרעינים וממרחים": 4,
  "מנות ותבשילים": 5,
  משקאות: 3,
  "רטבים, שמנים ותבלינים": 4,
  "חטיפים ומתוקים": 6,
};

/** Categories that are free at ANY reported quantity (product rule). */
export const ZERO_POINT_CATEGORIES: ReadonlySet<string> = new Set<FoodCategory>([
  "ירקות ועשבי תיבול",
]);

/** A food with no category and no calibration (custom foods): per portion. */
export const UNKNOWN_FOOD_PORTION_POINTS = 3;

// ---------------------------------------------------------------------------
// Subjective ("לפי תחושה") portion multipliers. Stored values keep the
// historical "הרבה" for compatibility; the UI shows "יותר מדי".
// ---------------------------------------------------------------------------
export const SUBJECTIVE_MULTIPLIER_V2: Record<SubjectiveAmount, number> = {
  מעט: 0.5,
  במידה: 1,
  הרבה: 1.5,
  מוגזם: 2,
};

export const SUBJECTIVE_LABEL: Record<SubjectiveAmount, string> = {
  מעט: "מעט",
  במידה: "במידה",
  הרבה: "יותר מדי",
  מוגזם: "מוגזם",
};

// ---------------------------------------------------------------------------
// Measured quantity → standard portions. Two families, never mixed:
//  - weight / volume units scale against a standard portion mass/volume;
//  - count / serving units are portions in themselves (a slice, a cup, a unit).
// "1 גרם = one portion" is impossible by construction.
// ---------------------------------------------------------------------------
export const STANDARD_PORTION_GRAMS = 100;
export const STANDARD_PORTION_ML = 250;

export const UNIT_FAMILY: Record<Unit, "weight" | "volume" | "count"> = {
  גרם: "weight",
  "ק״ג": "weight",
  "מ״ל": "volume",
  ליטר: "volume",
  יחידה: "count",
  "חצי יחידה": "count",
  כף: "count",
  כפית: "count",
  כוס: "count",
  ספל: "count",
  פרוסה: "count",
  קערה: "count",
  מנה: "count",
};

/** Grams / millilitres per unit for the weight & volume families. */
export const UNIT_TO_GRAMS: Partial<Record<Unit, number>> = { גרם: 1, "ק״ג": 1000 };
export const UNIT_TO_ML: Partial<Record<Unit, number>> = { "מ״ל": 1, ליטר: 1000 };

/**
 * Portions per ONE count/serving unit. A spoon of something is a fraction of a
 * portion; a bowl or a mug is more than one.
 */
export const COUNT_UNIT_PORTIONS: Record<
  Extract<Unit, "יחידה" | "חצי יחידה" | "כף" | "כפית" | "כוס" | "ספל" | "פרוסה" | "קערה" | "מנה">,
  number
> = {
  יחידה: 1,
  "חצי יחידה": 0.5,
  כף: 0.25,
  כפית: 0.1,
  כוס: 1,
  ספל: 1.25,
  פרוסה: 1,
  קערה: 1.5,
  מנה: 1,
};

/** Result rounding: nearest half point; a non-zero food never rounds to 0. */
export const POINTS_ROUNDING_STEP = 0.5;
export const MIN_NONZERO_ENTRY_POINTS = 0.5;

// ---------------------------------------------------------------------------
// Nutrition-aware scoring (only when REAL facts exist on a food — never
// fabricated). Per standard serving of the food's own facts. Transparent linear
// approximation of the public principles: energy costs, saturated fat and added
// sugar cost more, protein and fibre give back, unsaturated fat gives back a
// little. Not the proprietary WW formula.
// ---------------------------------------------------------------------------
export const NUTRITION_WEIGHTS_V2 = {
  perCalorie: 1 / 33,
  perSaturatedFatG: 0.275,
  perAddedSugarG: 0.12,
  perProteinG: -0.098,
  perFiberG: -0.12,
  perUnsaturatedFatG: -0.02,
} as const;

// ---------------------------------------------------------------------------
// Personalised daily budget. Metabolic backbone = Mifflin-St Jeor (public
// equation), mapped to points by a provisional, tunable reference. NOT the
// official Weight Watchers budget equation and not a calorie prescription.
// ---------------------------------------------------------------------------
export const BUDGET_V2 = {
  /** BMR of a reference person that maps to REFERENCE_DAILY_POINTS. */
  REFERENCE_BMR: 1400,
  REFERENCE_DAILY_POINTS: 23,
  /** Maintenance mode: documented uplift over the weight-loss budget. */
  MAINTENANCE_UPLIFT: 1.2,
  /** Safe product range for the weight-loss budget. */
  MIN_DAILY_POINTS: 14,
  MAX_DAILY_POINTS: 45,
  /** Rounding of the final budget (points). */
  ROUNDING_STEP: 1,
  /** Used while sex / birth date / height / weight are incomplete. */
  FALLBACK_DAILY_POINTS: 23,
  /** Mifflin-St Jeor constants. */
  MIFFLIN: { weight: 10, height: 6.25, age: 5, male: 5, female: -161 },
  /** Manual override bounds (same product range). */
  OVERRIDE_MIN: 10,
  OVERRIDE_MAX: 60,
} as const;
