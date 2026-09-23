export type ProfileId = "me" | "elena";

/** The other member of the two-person household. */
export function partnerOf(profile: ProfileId): ProfileId {
  return profile === "me" ? "elena" : "me";
}

export interface Profile {
  id: ProfileId;
  name: string;
  initials: string;
  /** Personal accent colour — the one visual cue of ownership everywhere (avatar, editor header). */
  color: string;
  /** Soft tint of `color` for backgrounds. */
  tint: string;
}

export type MealSlotId =
  | "breakfast"
  | "morning_snack"
  | "lunch"
  | "afternoon_snack"
  | "dinner"
  | "late";

export const MEAL_SLOTS: MealSlotId[] = [
  "breakfast",
  "morning_snack",
  "lunch",
  "afternoon_snack",
  "dinner",
  "late",
];

export type MealStatus = "empty" | "logged" | "skipped";

export type QuantityMode = "measured" | "subjective";
export type SubjectiveAmount = "מעט" | "במידה" | "הרבה" | "מוגזם";

export type Unit =
  | "גרם"
  | "ק״ג"
  | "מ״ל"
  | "ליטר"
  | "יחידה"
  | "חצי יחידה"
  | "כף"
  | "כפית"
  | "כוס"
  | "ספל"
  | "פרוסה"
  | "קערה"
  | "מנה";

export const ALL_UNITS: Unit[] = [
  "גרם",
  "ק״ג",
  "מ״ל",
  "ליטר",
  "יחידה",
  "חצי יחידה",
  "כף",
  "כפית",
  "כוס",
  "ספל",
  "פרוסה",
  "קערה",
  "מנה",
];

/**
 * Practical measured units offered for a coffee entry. Subset of {@link ALL_UNITS}
 * so coffee stays a normal measured food entry without a parallel unit system.
 */
export const COFFEE_UNITS: Unit[] = ["כוס", "ספל", "יחידה", "מ״ל"];

/**
 * Distinguishes foods that need a specialised entry flow. A `coffee` food opens
 * the coffee editor (type + milk) instead of the generic quantity selector.
 */
export type FoodKind = "generic" | "coffee";

export interface Food {
  id: string;
  name: string;
  category?: string;
  defaultUnit?: Unit;
  suggestedUnits?: Unit[];
  kind?: FoodKind;
  /**
   * Calibrated points per STANDARD PORTION (DEC-034 hierarchy step 1). Set only
   * from real calibration (e.g. Elena's experiential values); overrides both
   * nutrition facts and the category fallback.
   */
  pointsPerPortion?: number;
  /** Real nutrition facts per serving (hierarchy step 2). Never fabricated. */
  nutrition?: import("./points").NutritionFacts;
  /**
   * Mirrors `foods.is_active`. Only set on foods loaded from Supabase: `false`
   * means the household archived it, which removes it from the catalog while
   * keeping historical entries readable (they store the name).
   */
  isActive?: boolean;
  /**
   * Canonical points reference (DEC-035/036): the reference group (food) this
   * row is linked to. For a canonical card it is the card's own group; for a
   * personal alias (custom food) it is the EXPLICIT verified link — the only
   * way a custom food may exist in the active list. Points come from there.
   */
  referenceGroupKey?: string;
  /** @deprecated DEC-035 custom portion value; read for history only, never written since DEC-036. */
  portionAmount?: number;
  /** @deprecated see portionAmount. */
  portionUnit?: Unit;
  /** @deprecated see portionAmount. */
  pointsStatus?: "unscored" | "confirmed";
  /** Which person created a custom food / personal alias (owner scope). */
  createdBy?: ProfileId;
}

// --- Coffee ---------------------------------------------------------------
// Coffee is a normal food entry with structured, future-safe attributes stored
// on `FoodEntry.coffee` (not buried in a free-text note). Daily completeness is
// unaffected — coffee only matters as an entry inside a meal slot.

export type CoffeeType =
  | "אספרסו"
  | "אספרסו כפול"
  | "אמריקנו"
  | "קפה שחור"
  | "נס קפה"
  | "קפוצ׳ינו"
  | "לאטה"
  | "פילטר"
  | "אחר";

export const COFFEE_TYPES: CoffeeType[] = [
  "אספרסו",
  "אספרסו כפול",
  "אמריקנו",
  "קפה שחור",
  "נס קפה",
  "קפוצ׳ינו",
  "לאטה",
  "פילטר",
  "אחר",
];

export type MilkChoice = "ללא חלב" | "עם חלב";
export const MILK_CHOICES: MilkChoice[] = ["ללא חלב", "עם חלב"];

export type MilkType =
  | "חלב רגיל"
  | "חלב דל שומן"
  | "חלב ללא לקטוז"
  | "סויה"
  | "שקדים"
  | "שיבולת שועל"
  | "אחר";

export const MILK_TYPES: MilkType[] = [
  "חלב רגיל",
  "חלב דל שומן",
  "חלב ללא לקטוז",
  "סויה",
  "שקדים",
  "שיבולת שועל",
  "אחר",
];

export interface CoffeeMeta {
  type: CoffeeType;
  milk: MilkChoice;
  /** Only meaningful when `milk === "עם חלב"`; must be cleared otherwise. */
  milkType?: MilkType;
  note?: string;
}

export interface FoodEntry {
  id: string;
  foodId: string;
  foodName: string;
  mode: QuantityMode;
  amount?: number;
  unit?: Unit;
  subjective?: SubjectiveAmount;
  /** Present only for coffee entries. */
  coffee?: CoffeeMeta;
  /**
   * Snapshot of the points at log/edit time (DEC-035/036: from the reference
   * only). null = saved unscored (no reference row could be resolved); absent =
   * a legacy entry logged before snapshots existed. Never estimated on display.
   */
  pointsValue?: number | null;
  /** Model version of the persisted snapshot ("v1" legacy or "v2-il"); never rewritten in place. */
  pointsModelVersion?: string;
  /**
   * Snapshot provenance (DEC-035): "reference:exact" / "reference:scaled" /
   * "reference:any" / "custom:confirmed" / "model:v2-il" / "zero:coffee".
   */
  pointsBasis?: string;
  /** The reference row the snapshot was derived from (chosen variation). */
  referenceItemId?: string;
  /** Base points before a conditional benefit; equals pointsValue when none applied. */
  basePoints?: number | null;
  /** The daily benefit applied to this entry, if any (one per entry). */
  benefitRule?: "zero_any_quantity" | "fruit_daily_allowance" | "protein_zero_allowance";
  /** DEC-037 — the dish revision this serving was logged from (immutable provenance). */
  dishId?: string;
  dishRevision?: number;
  /** DEC-037 — the label-estimated product this entry was scored from. */
  estimatedProductId?: string;
  /** Grams consumed (dish servings, and estimated products logged by weight). */
  consumedWeightG?: number;
  /** Whether those grams were weighed or estimated by the person. */
  weightSource?: WeightSource;
  /**
   * When the entry was logged (ISO). Set locally at creation and read back from
   * the row's `created_at`; never sent on writes (the database owns it). Used
   * for "latest activity" only — not part of any equality / sync decision.
   */
  loggedAt?: string;
}

export interface DailyMeal {
  slot: MealSlotId;
  status: MealStatus;
  entries: FoodEntry[];
}

export interface FastingLog {
  start: string; // HH:mm
  end: string; // HH:mm
}

export type WorkoutType =
  | "כוח"
  | "אירובי"
  | "הליכה"
  | "ריצה"
  | "אופניים"
  | "שחייה"
  | "יוגה / גמישות"
  | "ספורט קבוצתי"
  | "אחר";

export type WorkoutFeeling = "קל" | "טוב" | "מאתגר" | "קשה" | "אחר";

export interface WorkoutLog {
  performed: boolean | null; // null = not documented
  type?: WorkoutType;
  feeling?: WorkoutFeeling;
}

export interface WeighIn {
  id: string;
  dateISO: string; // yyyy-mm-dd
  time?: string; // HH:mm
  weightKg: number;
  bodyFatPct?: number;
}

/** Daily step reporting. steps is absent for the quick "ביצעתי" mode. */
export interface StepLog {
  goalSteps: number;
  steps?: number;
  completed: boolean;
}

export interface DayData {
  meals: Record<MealSlotId, DailyMeal>;
  fasting?: FastingLog;
  workout?: WorkoutLog;
  steps?: StepLog;
}

export type SyncState = "saved" | "saving" | "offline" | "pending" | "error";

// --- Dishes, weight bridges and label-estimated products (DEC-037) ----------
// Derived household entities. They never write into the canonical reference
// (DEC-036); an estimated value is always visibly separate from a reference one.

/** Where a points value came from, at the level of the SOURCE (not the row). */
export type PointsSourceKind = "reference" | "estimated";

/** Provenance of an explicit "1 <unit> = N grams" fact. Never inferred. */
export type BridgeProvenance = "label" | "user_measured";

export interface WeightBridge {
  id: string;
  sourceKind: PointsSourceKind;
  /** Reference group key, or the estimated product id. */
  sourceKey: string;
  /** The exact reference row the bridge was measured on (reference sources only). */
  referenceItemId?: string;
  /** The estimated product the bridge belongs to (estimated sources only). */
  estimatedProductId?: string;
  unit: Unit;
  gramsPerUnit: number;
  provenance: BridgeProvenance;
  createdBy?: ProfileId;
}

/** What the person typed off the package. Missing optional values stay absent. */
export type LabelBasis = "per_100g" | "per_serving";

export interface LabelInput {
  basis: LabelBasis;
  /** Required for `per_serving`: the weight of ONE serving in grams. */
  servingWeightG?: number;
  calories: number;
  proteinG?: number;
  fiberG?: number;
  saturatedFatG?: number;
  addedSugarG?: number;
  unsaturatedFatG?: number;
}

export interface EstimatedProduct {
  id: string;
  name: string;
  brand?: string;
  label: LabelInput;
  /** Deterministic normalisation of `label` to a 100 g basis. */
  pointsPer100g: number;
  estimatorVersion: string;
  createdBy?: ProfileId;
  isActive?: boolean;
}

/** One ingredient as it was when the dish revision was saved. Write-once. */
export interface DishIngredient {
  sourceKind: PointsSourceKind;
  /** User-visible name at save time. */
  name: string;
  /** Reference row identity (reference ingredients). */
  referenceItemId?: string;
  referenceGroupKey?: string;
  /** Dataset version of that reference row (provenance). */
  sourceVersion?: string;
  /** Estimated product identity + its estimator version (estimated ingredients). */
  estimatedProductId?: string;
  estimatorVersion?: string;
  /** The quantity the person entered. */
  amount: number;
  unit: Unit;
  /** Human-readable basis, e.g. "1 כף (15 גרם)" or "100 גרם". */
  basisText: string;
  /** Grams this ingredient contributed, when the amount resolves to grams. */
  gramsUsed?: number;
  /** The bridge COPY used to reach grams, if one was needed. */
  bridge?: { unit: Unit; gramsPerUnit: number; provenance: BridgeProvenance };
  /** Points this ingredient contributed to the dish total. */
  points: number;
}

export interface Dish {
  id: string;
  name: string;
  revision: number;
  ingredients: DishIngredient[];
  totalPoints: number;
  finalWeightG: number;
  /** totalPoints / finalWeightG — full precision, rounded only when logging. */
  pointsPerGram: number;
  usualServingWeightG?: number;
  createdBy?: ProfileId;
  isActive?: boolean;
  /** True when any ingredient is label-estimated (the dish is marked in the UI). */
  hasEstimatedIngredient?: boolean;
}

/** How the consumed weight of a dish serving was obtained. */
export type WeightSource = "weighed" | "estimated";
