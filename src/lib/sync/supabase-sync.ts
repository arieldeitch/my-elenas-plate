/**
 * Sync manager glue between the store and Supabase.
 *
 * M1 (shared-truth recovery): the routine write path is `applyOperation`, which
 * executes ONE narrowly scoped, idempotent mutation. The former whole-day
 * reconciliation `pushDay()` is kept ONLY as an explicitly named recovery tool
 * (`pushDaySnapshotUNSAFE`) because it deletes every remote entry absent from
 * the caller's local snapshot — which is exactly how a stale device used to
 * erase its partner's entries. Nothing interactive may call it.
 *
 * Hydration reads a day from Supabase; `subscribeHousehold` exposes realtime
 * change events with their payload metadata so the caller can target the
 * affected profile/date instead of blindly reloading the current view.
 */
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { DayData, Food, ProfileId } from "../domain";
import { MEAL_SLOTS } from "../domain";
import { requireSupabase } from "../supabase/client";
import { entryToRow, slotToSlug, statusToDb, type Preference } from "../supabase/mappers";
import {
  bumpRecent,
  deleteEntry,
  deleteFasting,
  deleteWorkout,
  loadDay,
  loadFoods,
  loadPreferences,
  loadProfilePointsBudget,
  setFavorite,
  setMealStatus,
  upsertFasting,
  upsertDailySteps,
  upsertFood,
  upsertWeighIn,
  upsertWorkout,
  updateProfilePointsBudget,
  type HouseholdContext,
} from "../supabase/repositories";
import { SLUG_BY_LOCAL_PROFILE } from "./migrate-local";
import { isCustomFoodId } from "./migrate-local";
import type { Operation } from "./operations";

export function profileIdFor(ctx: HouseholdContext, local: ProfileId): string | undefined {
  return ctx.profileIdBySlug[SLUG_BY_LOCAL_PROFILE[local]];
}

/** Reverse lookup: DB profile id -> local profile id (for realtime payloads). */
export function localProfileFor(ctx: HouseholdContext, profileId: string): ProfileId | undefined {
  for (const local of ["me", "elena"] as ProfileId[]) {
    if (profileIdFor(ctx, local) === profileId) return local;
  }
  return undefined;
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

// --- operation execution (routine write path) --------------------------------

export class UnknownProfileError extends Error {
  constructor(local: ProfileId) {
    super(`No remote profile for local profile "${local}"`);
    this.name = "UnknownProfileError";
  }
}

function requireProfile(ctx: HouseholdContext, local: ProfileId): string {
  const id = profileIdFor(ctx, local);
  if (!id) throw new UnknownProfileError(local);
  return id;
}

/**
 * Executes exactly one operation against Supabase. Every branch is idempotent:
 * upserts are keyed by client uuid or the table's natural key; deletes target a
 * single row and succeed when it is already gone. Nothing here reads a whole
 * day or deletes rows the operation does not name.
 */
export async function applyOperation(ctx: HouseholdContext, op: Operation): Promise<void> {
  const householdId = ctx.householdId;
  switch (op.kind) {
    case "entry.upsert": {
      const profileId = requireProfile(ctx, op.profile);
      const sb = requireSupabase();
      const row = entryToRow(op.entry, { householdId, profileId, logDate: op.iso, slot: op.slot });
      const { error } = await sb.from("food_entries").upsert(row, { onConflict: "id" });
      if (error) throw error;
      return;
    }
    case "entry.delete": {
      await deleteEntry(op.entryId);
      return;
    }
    case "status.set": {
      const profileId = requireProfile(ctx, op.profile);
      await setMealStatus(householdId, profileId, op.iso, op.slot, op.status);
      return;
    }
    case "fasting.set": {
      const profileId = requireProfile(ctx, op.profile);
      await upsertFasting(householdId, profileId, op.iso, op.fasting.start, op.fasting.end);
      return;
    }
    case "fasting.clear": {
      const profileId = requireProfile(ctx, op.profile);
      await deleteFasting(profileId, op.iso);
      return;
    }
    case "workout.set": {
      const profileId = requireProfile(ctx, op.profile);
      await upsertWorkout(householdId, profileId, op.iso, op.workout);
      return;
    }
    case "workout.clear": {
      const profileId = requireProfile(ctx, op.profile);
      await deleteWorkout(profileId, op.iso);
      return;
    }
    case "steps.set": {
      const profileId = requireProfile(ctx, op.profile);
      await upsertDailySteps(householdId, profileId, op.iso, op.steps);
      return;
    }
    case "profile.points-budget.set": {
      const profileId = requireProfile(ctx, op.profile);
      await updateProfilePointsBudget(profileId, op.budget);
      return;
    }
    case "weighin.insert": {
      const profileId = requireProfile(ctx, op.profile);
      await upsertWeighIn(householdId, profileId, op.weighIn);
      return;
    }
    case "food.upsert": {
      // Built-in catalog foods are a client constant; only custom foods sync.
      if (!isCustomFoodId(op.food.id)) return;
      await upsertFood(householdId, op.food);
      return;
    }
    case "pref.favorite": {
      const profileId = requireProfile(ctx, op.profile);
      await setFavorite(householdId, profileId, op.foodId, op.isFavorite);
      return;
    }
    case "pref.recent": {
      const profileId = requireProfile(ctx, op.profile);
      await bumpRecent(householdId, profileId, op.foodId, op.at);
      return;
    }
  }
}

// --- recovery-only snapshot reconciliation (NOT a routine write path) -------

/**
 * Whole-day snapshot reconciliation. DESTRUCTIVE: deletes every remote entry
 * for the profile/date that is absent from `day`. Retained solely for a
 * deliberate, human-triggered recovery/migration of one day. Interactive edits
 * must go through `applyOperation`; there is intentionally no caller in the
 * store or the sync hook.
 */
export async function pushDaySnapshotUNSAFE(
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
    await upsertFasting(ctx.householdId, profileId, iso, day.fasting.start, day.fasting.end);
  }
  if (day.workout) {
    await upsertWorkout(ctx.householdId, profileId, iso, day.workout);
  }
  if (day.steps) {
    await upsertDailySteps(ctx.householdId, profileId, iso, day.steps);
  }
}

// --- custom foods + favorites/recents --------------------------------------

/** Loads the household's custom foods. */
export function hydrateFoods(ctx: HouseholdContext): Promise<Food[]> {
  return loadFoods(ctx.householdId);
}

/** Loads a profile's preference rows (favorites + recents). */
export function hydrateProfilePointsBudget(ctx: HouseholdContext, local: ProfileId): Promise<number> {
  const profileId = profileIdFor(ctx, local);
  if (!profileId) return Promise.resolve(30);
  return loadProfilePointsBudget(profileId);
}

export function hydratePreferences(ctx: HouseholdContext, local: ProfileId): Promise<Preference[]> {
  const profileId = profileIdFor(ctx, local);
  if (!profileId) return Promise.resolve([]);
  return loadPreferences(profileId);
}

// --- realtime ---------------------------------------------------------------

/** All user-visible mutable tables the daily experience depends on. */
export const REALTIME_TABLES = [
  "profiles",
  "food_entries",
  "meal_statuses",
  "fasting_logs",
  "workout_logs",
  "daily_steps",
  "weigh_ins",
  "foods",
  "food_preferences",
] as const;
export type RealtimeTable = (typeof REALTIME_TABLES)[number];

export interface RealtimeChange {
  table: RealtimeTable;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  /** Local profile the row belongs to, when the payload carries `profile_id`. */
  profile?: ProfileId;
  /** ISO date the row belongs to, when the payload carries `log_date`. */
  iso?: string;
  /** Primary key of the affected row, when present. */
  rowId?: string;
}

type RowLike = { profile_id?: string; log_date?: string; id?: string };

/**
 * Extracts the affected profile/date from a postgres_changes payload (pure).
 * DELETE payloads under default replica identity only carry the primary key,
 * so `profile`/`iso` are undefined for them — callers must fall back to a
 * broader refresh in that case.
 */
export function describeChange(
  ctx: HouseholdContext,
  table: RealtimeTable,
  payload: Pick<RealtimePostgresChangesPayload<RowLike>, "eventType" | "new" | "old">,
): RealtimeChange {
  const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as RowLike | undefined;
  const change: RealtimeChange = { table, eventType: payload.eventType };
  const profileId =
    table === "profiles"
      ? row?.id ?? (payload.old as RowLike | undefined)?.id
      : row?.profile_id ?? (payload.old as RowLike | undefined)?.profile_id;
  if (profileId) change.profile = localProfileFor(ctx, profileId);
  const iso = row?.log_date ?? (payload.old as RowLike | undefined)?.log_date;
  if (iso) change.iso = iso;
  if (row?.id) change.rowId = row.id;
  return change;
}

// Unique per subscription so a re-activation never collides with an
// already-subscribed channel of the same name ("cannot add callbacks after
// subscribe()"), e.g. under React StrictMode double-mount or auth re-fire.
let channelSeq = 0;

/**
 * Subscribes to realtime changes for every table in `REALTIME_TABLES` and calls
 * `onChange` with a described change. Returns an unsubscribe fn.
 */
export type RealtimeStatus = "connecting" | "subscribed" | "error";

export function subscribeHousehold(
  ctx: HouseholdContext,
  onChange: (change: RealtimeChange) => void,
  accessToken?: string,
  onStatus?: (status: RealtimeStatus) => void,
): () => void {
  const sb = requireSupabase();
  // Give the realtime socket the auth token so RLS lets this session receive
  // the household's changes (required for postgres_changes over RLS).
  if (accessToken) sb.realtime.setAuth(accessToken);
  const channel: RealtimeChannel = sb.channel(`household:${ctx.householdId}:${++channelSeq}`);
  for (const table of REALTIME_TABLES) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload: RealtimePostgresChangesPayload<RowLike>) =>
        onChange(describeChange(ctx, table, payload)),
    );
  }
  onStatus?.("connecting");
  channel.subscribe((status, err) => {
    // Observable channel lifecycle: a silent CHANNEL_ERROR / TIMED_OUT is the
    // difference between "realtime works" and "the partner never sees it".
    if (status === "SUBSCRIBED") {
      console.info("[realtime] subscribed", channel.topic);
      onStatus?.("subscribed");
    } else if (status === "CLOSED") {
      // Socket dropped; supabase-js rejoins automatically once it reconnects.
      onStatus?.("connecting");
    } else {
      console.warn("[realtime]", status, channel.topic, err?.message ?? "");
      onStatus?.("error");
    }
  });
  return () => {
    void sb.removeChannel(channel);
  };
}
