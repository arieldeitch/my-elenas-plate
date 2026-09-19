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
  /** Snapshot from the transparent internal points model at log/edit time. */
  pointsValue?: number;
  /** Model version of the persisted snapshot ("v1" legacy or "v2-il"); never rewritten in place. */
  pointsModelVersion?: string;
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
