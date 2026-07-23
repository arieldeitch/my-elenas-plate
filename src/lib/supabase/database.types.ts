/**
 * Canonical DB types come from `database.generated.ts`
 * (`supabase gen types typescript --local`). This module re-exports them and
 * adds the domain-narrowed enum types + named Row/Insert aliases used across the
 * data layer. Regenerate the .generated file whenever the migrations change.
 */
import type { Database, Json } from "./database.generated";

export type { Database, Json };

export type MealSlotSlug =
  "opening_window" | "first_snack" | "main_meal" | "afternoon_snack" | "dinner" | "extra_meal";

export type MealStatusValue = "unmarked" | "logged" | "skipped";
export type QuantityModeValue = "measured" | "subjective";
export type SubjectiveValue = "little" | "moderate" | "much" | "excessive";

export interface CoffeeJson {
  type: string;
  milk: string;
  milkType?: string;
  note?: string;
}

type T = Database["public"]["Tables"];

export type HouseholdRow = T["households"]["Row"];
export type ProfileRow = T["profiles"]["Row"];
export type FoodRow = T["foods"]["Row"];
export type FoodPreferenceRow = T["food_preferences"]["Row"];
export type MealStatusRow = T["meal_statuses"]["Row"];
export type FoodEntryRow = T["food_entries"]["Row"];
export type FoodEntryInsert = T["food_entries"]["Insert"];
export type FastingLogRow = T["fasting_logs"]["Row"];
export type WorkoutLogRow = T["workout_logs"]["Row"];
export type WeighInRow = T["weigh_ins"]["Row"];
