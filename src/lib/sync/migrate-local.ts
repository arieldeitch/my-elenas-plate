/**
 * One-time migration of legacy localStorage demo data into Supabase.
 *
 * `buildMigrationPayload` is a pure transform (unit-tested). `runMigration`
 * uploads it, verifies the remote row counts, then sets a completed marker.
 * Local data is NOT deleted — it stays as a recoverable fallback.
 */
import type { ProfileId } from "../domain";
import { MEAL_SLOTS } from "../domain";
import type { PersistedState } from "../persistence";
import type { FoodEntryInsert, MealSlotSlug, MealStatusValue } from "../supabase/database.types";
import { entryToRow, slotToSlug, statusToDb } from "../supabase/mappers";

const MIGRATION_MARKER = "elenas-plate:migrated:v1";

/** Maps the two local profile ids to their DB profile slugs. */
export const SLUG_BY_LOCAL_PROFILE: Record<ProfileId, string> = {
  me: "ariel",
  elena: "alena",
};

export interface MigrationPayload {
  mealStatuses: Array<{
    household_id: string;
    profile_id: string;
    log_date: string;
    slot: MealSlotSlug;
    status: MealStatusValue;
  }>;
  foodEntries: FoodEntryInsert[];
  fasting: Array<{
    household_id: string;
    profile_id: string;
    log_date: string;
    start_time: string;
    end_time: string;
  }>;
  workouts: Array<{
    household_id: string;
    profile_id: string;
    log_date: string;
    performed: boolean | null;
    workout_type: string | null;
    feeling: string | null;
  }>;
  weighIns: Array<{
    household_id: string;
    profile_id: string;
    measured_on: string;
    measured_at: string | null;
    weight_kg: number;
    body_fat_pct: number | null;
  }>;
}

/**
 * Transforms persisted local state into Supabase insert payloads. Skips empty
 * meal slots (no status/entries) so the import stays minimal and idempotent.
 */
export function buildMigrationPayload(
  state: PersistedState,
  householdId: string,
  profileIdBySlug: Record<string, string>,
): MigrationPayload {
  const out: MigrationPayload = {
    mealStatuses: [],
    foodEntries: [],
    fasting: [],
    workouts: [],
    weighIns: [],
  };

  for (const local of Object.keys(state.days) as ProfileId[]) {
    const slug = SLUG_BY_LOCAL_PROFILE[local];
    const profileId = profileIdBySlug[slug];
    if (!profileId) continue; // profile missing → skip rather than mis-assign

    const days = state.days[local];
    for (const logDate of Object.keys(days)) {
      const day = days[logDate];
      for (const slot of MEAL_SLOTS) {
        const meal = day.meals[slot];
        if (!meal || (meal.status === "empty" && meal.entries.length === 0)) continue;
        out.mealStatuses.push({
          household_id: householdId,
          profile_id: profileId,
          log_date: logDate,
          slot: slotToSlug(slot),
          status: statusToDb(meal.status),
        });
        for (const entry of meal.entries) {
          out.foodEntries.push(entryToRow(entry, { householdId, profileId, logDate, slot }));
        }
      }
      if (day.fasting) {
        out.fasting.push({
          household_id: householdId,
          profile_id: profileId,
          log_date: logDate,
          start_time: day.fasting.start,
          end_time: day.fasting.end,
        });
      }
      if (day.workout) {
        out.workouts.push({
          household_id: householdId,
          profile_id: profileId,
          log_date: logDate,
          performed: day.workout.performed,
          workout_type: day.workout.type ?? null,
          feeling: day.workout.feeling ?? null,
        });
      }
    }

    for (const w of state.weighIns[local] ?? []) {
      out.weighIns.push({
        household_id: householdId,
        profile_id: profileId,
        measured_on: w.dateISO,
        measured_at: w.time ?? null,
        weight_kg: w.weightKg,
        body_fat_pct: w.bodyFatPct ?? null,
      });
    }
  }

  return out;
}

export function isMigrated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MIGRATION_MARKER) === "done";
  } catch {
    return false;
  }
}

export function markMigrated(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIGRATION_MARKER, "done");
  } catch (err) {
    console.warn("Failed to set migration marker", err);
  }
}

export function totalRows(payload: MigrationPayload): number {
  return (
    payload.mealStatuses.length +
    payload.foodEntries.length +
    payload.fasting.length +
    payload.workouts.length +
    payload.weighIns.length
  );
}
