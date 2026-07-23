/**
 * Sync manager glue between the store and Supabase. Hydrates a day from remote,
 * reconciles local -> remote writes (upsert present entries, delete removed),
 * and exposes a realtime subscription for the current household.
 *
 * The store's synchronous local update is the optimistic step; these functions
 * mirror it to Supabase. Failures are swallowed here and handled by the caller
 * via the offline queue + sync state.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { DayData, MealSlotId, ProfileId } from "../domain";
import { MEAL_SLOTS } from "../domain";
import { requireSupabase } from "../supabase/client";
import { entryToRow, slotToSlug, statusToDb } from "../supabase/mappers";
import { loadDay, type HouseholdContext } from "../supabase/repositories";
import { SLUG_BY_LOCAL_PROFILE } from "./migrate-local";

export function profileIdFor(ctx: HouseholdContext, local: ProfileId): string | undefined {
  return ctx.profileIdBySlug[SLUG_BY_LOCAL_PROFILE[local]];
}

/** Which remote entry ids should be deleted given the local set (pure). */
export function entriesToDelete(remoteIds: string[], localIds: string[]): string[] {
  const keep = new Set(localIds);
  return remoteIds.filter((id) => !keep.has(id));
}

/** Loads a day for a local profile id from Supabase. */
export async function hydrateDay(
  ctx: HouseholdContext,
  local: ProfileId,
  iso: string,
): Promise<DayData | null> {
  const profileId = profileIdFor(ctx, local);
  if (!profileId) return null;
  return loadDay(profileId, iso);
}

/**
 * Reconciles one day's meals to Supabase: upsert every non-empty slot status,
 * upsert current entries, delete entries removed locally. Also mirrors fasting.
 */
export async function pushDay(
  ctx: HouseholdContext,
  local: ProfileId,
  iso: string,
  day: DayData,
): Promise<void> {
  const sb = requireSupabase();
  const profileId = profileIdFor(ctx, local);
  if (!profileId) return;

  const statusRows = MEAL_SLOTS.map((slot) => ({
    household_id: ctx.householdId,
    profile_id: profileId,
    log_date: iso,
    slot: slotToSlug(slot),
    status: statusToDb(day.meals[slot].status),
  }));
  const { error: sErr } = await sb
    .from("meal_statuses")
    .upsert(statusRows, { onConflict: "profile_id,log_date,slot" });
  if (sErr) throw sErr;

  const localEntries = MEAL_SLOTS.flatMap((slot) =>
    day.meals[slot].entries.map((e) =>
      entryToRow(e, { householdId: ctx.householdId, profileId, logDate: iso, slot }),
    ),
  );
  if (localEntries.length > 0) {
    const { error: eErr } = await sb.from("food_entries").upsert(localEntries);
    if (eErr) throw eErr;
  }

  const { data: remote, error: rErr } = await sb
    .from("food_entries")
    .select("id")
    .eq("profile_id", profileId)
    .eq("log_date", iso);
  if (rErr) throw rErr;
  const toDelete = entriesToDelete(
    (remote ?? []).map((r) => r.id),
    localEntries.map((e) => e.id).filter((id): id is string => Boolean(id)),
  );
  if (toDelete.length > 0) {
    const { error: dErr } = await sb.from("food_entries").delete().in("id", toDelete);
    if (dErr) throw dErr;
  }

  if (day.fasting) {
    await sb.from("fasting_logs").upsert(
      {
        household_id: ctx.householdId,
        profile_id: profileId,
        log_date: iso,
        start_time: day.fasting.start,
        end_time: day.fasting.end,
      },
      { onConflict: "profile_id,log_date" },
    );
  }
  if (day.workout) {
    await sb.from("workout_logs").upsert(
      {
        household_id: ctx.householdId,
        profile_id: profileId,
        log_date: iso,
        performed: day.workout.performed,
        workout_type: day.workout.type ?? null,
        feeling: day.workout.feeling ?? null,
      },
      { onConflict: "profile_id,log_date" },
    );
  }
}

/**
 * Subscribes to realtime changes for the household's data tables and calls
 * `onChange` with the affected local slot table name. Returns an unsubscribe fn.
 */
export function subscribeHousehold(
  ctx: HouseholdContext,
  onChange: (table: string) => void,
): () => void {
  const sb = requireSupabase();
  const channel: RealtimeChannel = sb
    .channel(`household:${ctx.householdId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "food_entries" }, () =>
      onChange("food_entries"),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "meal_statuses" }, () =>
      onChange("meal_statuses"),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "weigh_ins" }, () =>
      onChange("weigh_ins"),
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}

export type { MealSlotId };
