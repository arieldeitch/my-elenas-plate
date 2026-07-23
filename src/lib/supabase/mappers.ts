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
  FoodEntry,
  MealSlotId,
  MealStatus,
  QuantityMode,
  SubjectiveAmount,
  Unit,
} from "../domain";
import type {
  CoffeeJson,
  FoodEntryInsert,
  FoodEntryRow,
  Json,
  MealSlotSlug,
  MealStatusValue,
  SubjectiveValue,
} from "./database.types";

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
  return entry;
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
