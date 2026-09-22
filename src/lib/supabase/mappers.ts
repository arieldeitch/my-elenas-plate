/**
 * Pure translation between the frontend domain model and Supabase rows.
 *
 * The frontend keeps its existing slot ids (breakfast, morning_snack, …) and
 * Hebrew subjective/status wording; the database uses the canonical English
 * slugs from the migrations. All mapping is centralised and unit-tested so the
 * two vocabularies never drift. Generated row types are loose (string/Json), so
 * we narrow with casts only here, at the single boundary.
 */
import type {
  CoffeeMeta,
  DailyMeal,
  Food,
  FoodEntry,
  FoodKind,
  MealSlotId,
  MealStatus,
  ProfileId,
  QuantityMode,
  SubjectiveAmount,
  Unit,
} from "../domain";
import type {
  CoffeeJson,
  FoodEntryInsert,
  FoodEntryRow,
  FoodInsert,
  FoodPreferenceRow,
  FoodRow,
  Json,
  MealSlotSlug,
  MealStatusValue,
  SubjectiveValue,
} from "./database.types";
import { normalizeFoodName } from "../food-normalize";

// --- meal slot <-> slug -----------------------------------------------------
const SLOT_TO_SLUG: Record<MealSlotId, MealSlotSlug> = {
  breakfast: "opening_window",
  morning_snack: "first_snack",
  lunch: "main_meal",
  afternoon_snack: "afternoon_snack",
  dinner: "dinner",
  late: "extra_meal",
};
const SLUG_TO_SLOT = Object.fromEntries(
  Object.entries(SLOT_TO_SLUG).map(([k, v]) => [v, k]),
) as Record<MealSlotSlug, MealSlotId>;

export function slotToSlug(slot: MealSlotId): MealSlotSlug {
  return SLOT_TO_SLUG[slot];
}
export function slugToSlot(slug: string): MealSlotId {
  return SLUG_TO_SLOT[slug as MealSlotSlug];
}

// --- status <-> db ("empty" is "unmarked" on the wire) ----------------------
export function statusToDb(status: MealStatus): MealStatusValue {
  return status === "empty" ? "unmarked" : status;
}
export function statusFromDb(value: string): MealStatus {
  return value === "unmarked" ? "empty" : (value as MealStatus);
}

// --- subjective amount <-> db ----------------------------------------------
const SUBJECTIVE_TO_DB: Record<SubjectiveAmount, SubjectiveValue> = {
  מעט: "little",
  במידה: "moderate",
  הרבה: "much",
  מוגזם: "excessive",
};
const DB_TO_SUBJECTIVE = Object.fromEntries(
  Object.entries(SUBJECTIVE_TO_DB).map(([k, v]) => [v, k]),
) as Record<SubjectiveValue, SubjectiveAmount>;

export function subjectiveToDb(v: SubjectiveAmount): SubjectiveValue {
  return SUBJECTIVE_TO_DB[v];
}
export function subjectiveFromDb(v: string): SubjectiveAmount {
  return DB_TO_SUBJECTIVE[v as SubjectiveValue];
}

// --- coffee (stored as the domain shape; kept normalised) -------------------
function coffeeToJson(coffee: CoffeeMeta): Json {
  const json: Record<string, string> = { type: coffee.type, milk: coffee.milk };
  if (coffee.milk === "עם חלב" && coffee.milkType) json.milkType = coffee.milkType;
  if (coffee.note) json.note = coffee.note;
  return json;
}
function coffeeFromJson(json: Json | null): CoffeeMeta | undefined {
  if (!json || typeof json !== "object" || Array.isArray(json)) return undefined;
  const j = json as unknown as CoffeeJson;
  if (!j.type) return undefined;
  const coffee: CoffeeMeta = {
    type: j.type as CoffeeMeta["type"],
    milk: j.milk as CoffeeMeta["milk"],
  };
  if (j.milkType) coffee.milkType = j.milkType as CoffeeMeta["milkType"];
  if (j.note) coffee.note = j.note;
  return coffee;
}

export interface EntryContext {
  householdId: string;
  profileId: string;
  logDate: string;
  slot: MealSlotId;
}

/** Domain entry -> insert payload (timestamps assigned by the DB). */
export function entryToRow(entry: FoodEntry, ctx: EntryContext): FoodEntryInsert {
  return {
    id: entry.id,
    household_id: ctx.householdId,
    profile_id: ctx.profileId,
    log_date: ctx.logDate,
    slot: slotToSlug(ctx.slot),
    food_id: null,
    food_name: entry.foodName,
    quantity_mode: entry.mode,
    amount: entry.mode === "measured" ? (entry.amount ?? null) : null,
    unit: entry.mode === "measured" ? (entry.unit ?? null) : null,
    subjective:
      entry.mode === "subjective" && entry.subjective ? subjectiveToDb(entry.subjective) : null,
    coffee: entry.coffee ? coffeeToJson(entry.coffee) : null,
    note: entry.coffee?.note ?? null,
    points_value: entry.pointsValue ?? null,
    points_model_version: entry.pointsModelVersion ?? null,
    // DEC-035 snapshot provenance — written once with the snapshot, never rewritten.
    points_basis: entry.pointsBasis ?? null,
    reference_item_id: entry.referenceItemId ?? null,
    base_points: entry.basePoints ?? null,
    benefit_rule: entry.benefitRule ?? null,
  };
}

/** Supabase row -> domain entry. */
export function entryFromRow(row: FoodEntryRow): FoodEntry {
  const mode = row.quantity_mode as QuantityMode;
  const entry: FoodEntry = {
    id: row.id,
    foodId: row.food_id ?? "",
    foodName: row.food_name,
    mode,
  };
  if (mode === "measured") {
    entry.amount = row.amount ?? undefined;
    entry.unit = (row.unit as Unit) ?? undefined;
  } else if (row.subjective) {
    entry.subjective = subjectiveFromDb(row.subjective);
  }
  const coffee = coffeeFromJson(row.coffee);
  if (coffee) entry.coffee = coffee;
  if (row.points_value != null) entry.pointsValue = Number(row.points_value);
  if (row.points_model_version) entry.pointsModelVersion = row.points_model_version;
  if (row.points_basis) entry.pointsBasis = row.points_basis;
  if (row.reference_item_id) entry.referenceItemId = row.reference_item_id;
  if (row.base_points != null) entry.basePoints = Number(row.base_points);
  if (row.benefit_rule) entry.benefitRule = row.benefit_rule as FoodEntry["benefitRule"];
  if (row.created_at) entry.loggedAt = row.created_at;
  return entry;
}

// --- custom foods -----------------------------------------------------------
const DEFAULT_CUSTOM_UNITS: Unit[] = ["יחידה", "גרם", "מנה"];

/**
 * Domain custom Food -> foods insert payload. `createdByProfileId` is the DB
 * id of the person who created the food (owner scope, DEC-035); the confirmed
 * portion value travels with it so the partner's device scores it the same way.
 */
export function foodToRow(
  food: Food,
  householdId: string,
  createdByProfileId: string | null = null,
): FoodInsert {
  const row: FoodInsert = {
    id: food.id,
    household_id: householdId,
    name: food.name.trim(),
    normalized_name: normalizeFoodName(food.name),
    category: food.category ?? null,
    default_unit: food.defaultUnit ?? null,
    kind: food.kind ?? "generic",
    is_active: food.isActive ?? true,
    // DEC-036: a custom food is a personal alias of a reference food; it never
    // carries a value of its own (the DEC-035 columns stay null from now on).
    points_status: "unscored",
  };
  if (food.referenceGroupKey) row.reference_group_key = food.referenceGroupKey;
  if (createdByProfileId) row.created_by_profile_id = createdByProfileId;
  return row;
}

/**
 * foods row -> domain Food. `is_active` is carried through so `mergeCatalog` can
 * let an archived remote row hide a built-in food. Suggested units are a
 * client-side default: the column does not exist in the schema, and a built-in
 * food's richer unit set is restored by `mergeCatalog`.
 */
export function foodFromRow(row: FoodRow, localProfileById?: Map<string, ProfileId>): Food {
  const food: Food = {
    id: row.id,
    name: row.name,
    category: row.category ?? undefined,
    defaultUnit: (row.default_unit as Unit | null) ?? undefined,
    suggestedUnits: [...DEFAULT_CUSTOM_UNITS],
    kind: (row.kind as FoodKind) ?? "generic",
    isActive: row.is_active,
  };
  // Columns added by 20260921120000 — absent on a database that has not
  // applied it yet, so every read is defensive (the app must keep working).
  if (row.portion_amount != null) food.portionAmount = Number(row.portion_amount);
  if (row.portion_unit) food.portionUnit = row.portion_unit as Unit;
  if (row.points_status === "confirmed" && row.points_per_portion != null) {
    food.pointsStatus = "confirmed";
    food.pointsPerPortion = Number(row.points_per_portion);
  } else if (row.points_status) {
    food.pointsStatus = "unscored";
  }
  const creator = row.created_by_profile_id
    ? localProfileById?.get(row.created_by_profile_id)
    : undefined;
  if (creator) food.createdBy = creator;
  // DEC-036 explicit link (column added by 20260922090000; absent before).
  if (row.reference_group_key) food.referenceGroupKey = row.reference_group_key;
  return food;
}

export interface Preference {
  foodId: string;
  isFavorite: boolean;
  lastUsedAt: string | null;
  useCount: number;
}

export function preferenceFromRow(row: FoodPreferenceRow): Preference {
  return {
    foodId: row.food_id,
    isFavorite: row.is_favorite,
    lastUsedAt: row.last_used_at,
    useCount: row.use_count,
  };
}

/**
 * Derives the UI-facing favorites (ids) and recents (ids, newest-first, capped)
 * from a profile's preference rows. Single source so hydrate + demo agree.
 */
export function deriveFavoritesRecents(
  prefs: Preference[],
  recentLimit = 12,
): { favorites: string[]; recents: string[] } {
  const favorites = prefs.filter((p) => p.isFavorite).map((p) => p.foodId);
  const recents = prefs
    .filter((p) => p.lastUsedAt)
    .sort((a, b) => (a.lastUsedAt! < b.lastUsedAt! ? 1 : -1))
    .slice(0, recentLimit)
    .map((p) => p.foodId);
  return { favorites, recents };
}

/** Builds a DailyMeal from a DB status + its entry rows. */
export function mealFromRows(
  slot: MealSlotId,
  status: string | undefined,
  rows: FoodEntryRow[],
): DailyMeal {
  const entries = rows.map(entryFromRow);
  let resolved: MealStatus = status ? statusFromDb(status) : "empty";
  // Entries always imply "logged"; an empty non-skipped slot stays "empty".
  if (resolved !== "skipped") resolved = entries.length > 0 ? "logged" : "empty";
  return { slot, status: resolved, entries };
}
