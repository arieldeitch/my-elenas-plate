/**
 * Data-access layer between the store and Supabase. Thin, typed CRUD keyed by
 * household/profile/date. Security is enforced by RLS, not here. All functions
 * require a configured, authenticated client (see requireSupabase()).
 */
import { requireSupabase } from "./client";
import type { DayData, MealSlotId, WeighIn, WorkoutFeeling, WorkoutType } from "../domain";
import { MEAL_SLOTS } from "../domain";
import type { FoodEntryRow, MealStatusRow, ProfileRow } from "./database.types";
import { entryToRow, mealFromRows, slotToSlug, statusToDb, slugToSlot } from "./mappers";

export interface HouseholdContext {
  householdId: string;
  profileIdBySlug: Record<string, string>;
}

/** Ensures the household + two profiles exist and returns the mapping. */
export async function bootstrapHousehold(): Promise<HouseholdContext> {
  const sb = requireSupabase();
  const { data: householdId, error } = await sb.rpc("bootstrap_household");
  if (error) throw error;
  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select("*")
    .eq("household_id", householdId as string)
    .order("sort_order");
  if (pErr) throw pErr;
  const profileIdBySlug: Record<string, string> = {};
  for (const p of (profiles ?? []) as ProfileRow[]) profileIdBySlug[p.slug] = p.id;
  return { householdId: householdId as string, profileIdBySlug };
}

/** Loads a single day's meals (statuses + entries) for a profile. */
export async function loadDay(profileId: string, logDate: string): Promise<DayData> {
  const sb = requireSupabase();
  const [statuses, entries, fasting, workout] = await Promise.all([
    sb.from("meal_statuses").select("*").eq("profile_id", profileId).eq("log_date", logDate),
    sb.from("food_entries").select("*").eq("profile_id", profileId).eq("log_date", logDate),
    sb
      .from("fasting_logs")
      .select("*")
      .eq("profile_id", profileId)
      .eq("log_date", logDate)
      .maybeSingle(),
    sb
      .from("workout_logs")
      .select("*")
      .eq("profile_id", profileId)
      .eq("log_date", logDate)
      .maybeSingle(),
  ]);
  if (statuses.error) throw statuses.error;
  if (entries.error) throw entries.error;

  const statusBySlot = new Map<MealSlotId, MealStatusRow>();
  for (const s of (statuses.data ?? []) as MealStatusRow[]) {
    statusBySlot.set(slugToSlot(s.slot), s);
  }
  const entriesBySlot = new Map<MealSlotId, FoodEntryRow[]>();
  for (const e of (entries.data ?? []) as FoodEntryRow[]) {
    const slot = slugToSlot(e.slot);
    const list = entriesBySlot.get(slot) ?? [];
    list.push(e);
    entriesBySlot.set(slot, list);
  }

  const meals = {} as DayData["meals"];
  for (const slot of MEAL_SLOTS) {
    meals[slot] = mealFromRows(slot, statusBySlot.get(slot)?.status, entriesBySlot.get(slot) ?? []);
  }
  const day: DayData = { meals };
  if (fasting.data) day.fasting = { start: fasting.data.start_time, end: fasting.data.end_time };
  if (workout.data) {
    day.workout = {
      performed: workout.data.performed,
      type: (workout.data.workout_type as WorkoutType | null) ?? undefined,
      feeling: (workout.data.feeling as WorkoutFeeling | null) ?? undefined,
    };
  }
  return day;
}

export async function insertEntry(
  householdId: string,
  profileId: string,
  logDate: string,
  slot: MealSlotId,
  entry: Parameters<typeof entryToRow>[0],
): Promise<void> {
  const sb = requireSupabase();
  const row = entryToRow(entry, { householdId, profileId, logDate, slot });
  const { error } = await sb.from("food_entries").upsert(row);
  if (error) throw error;
  await setMealStatus(householdId, profileId, logDate, slot, "logged");
}

export async function deleteEntry(entryId: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("food_entries").delete().eq("id", entryId);
  if (error) throw error;
}

export async function setMealStatus(
  householdId: string,
  profileId: string,
  logDate: string,
  slot: MealSlotId,
  status: Parameters<typeof statusToDb>[0],
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("meal_statuses").upsert(
    {
      household_id: householdId,
      profile_id: profileId,
      log_date: logDate,
      slot: slotToSlug(slot),
      status: statusToDb(status),
    },
    { onConflict: "profile_id,log_date,slot" },
  );
  if (error) throw error;
}

export async function upsertFasting(
  householdId: string,
  profileId: string,
  logDate: string,
  start: string,
  end: string,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("fasting_logs").upsert(
    {
      household_id: householdId,
      profile_id: profileId,
      log_date: logDate,
      start_time: start,
      end_time: end,
    },
    { onConflict: "profile_id,log_date" },
  );
  if (error) throw error;
}

export async function loadWeighIns(profileId: string): Promise<WeighIn[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("weigh_ins")
    .select("*")
    .eq("profile_id", profileId)
    .order("measured_on");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    dateISO: r.measured_on,
    time: r.measured_at ?? undefined,
    weightKg: Number(r.weight_kg),
    bodyFatPct: r.body_fat_pct != null ? Number(r.body_fat_pct) : undefined,
  }));
}

export async function insertWeighIn(
  householdId: string,
  profileId: string,
  w: Omit<WeighIn, "id">,
): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("weigh_ins").insert({
    household_id: householdId,
    profile_id: profileId,
    measured_on: w.dateISO,
    measured_at: w.time ?? null,
    weight_kg: w.weightKg,
    body_fat_pct: w.bodyFatPct ?? null,
  });
  if (error) throw error;
}
