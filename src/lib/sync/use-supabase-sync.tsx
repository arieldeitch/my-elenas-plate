/**
 * React glue that activates Supabase sync inside the store — ONLY when Supabase
 * is configured and a session exists. In demo mode every effect returns early,
 * so the local app and its tests are completely unaffected.
 *
 * Responsibilities when active:
 *  - bootstrap the shared household + two profiles (idempotent RPC)
 *  - one-time migration of legacy localStorage data (non-destructive)
 *  - hydrate the current profile/date day + weigh-ins from Supabase
 *  - push locally-mutated days/weigh-ins (dirty-tracked to avoid echo loops)
 *  - subscribe to realtime and re-hydrate on remote changes
 *
 * All network work is wrapped defensively; failures set a sync state and keep
 * the optimistic local state intact.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DailySteps, DayData, Food, ProfileId, SyncState, WeighIn } from "../domain";
import { isSupabaseConfigured, requireSupabase } from "../supabase/client";
import { getSession, onAuthChange } from "../supabase/auth";
import {
  bootstrapHousehold,
  insertWeighIn,
  loadWeighIns,
  type HouseholdContext,
} from "../supabase/repositories";
import { deriveFavoritesRecents } from "../supabase/mappers";
import { BUILT_IN_FOODS, mergeCatalog } from "../food-catalog";
import {
  hydrateDay,
  hydrateFoods,
  hydratePreferences,
  hydrateStepGoal,
  profileIdFor,
  pushDay,
  pushFoods,
  pushPreferences,
  pushDailySteps,
  pushStepGoal,
  subscribeHousehold,
  type PrefMutation,
} from "./supabase-sync";
import {
  buildFoodMigrationPayload,
  buildMigrationPayload,
  isCustomFoodId,
  isFoodsMigrated,
  isMigrated,
  markFoodsMigrated,
  markMigrated,
  totalFoodRows,
  totalRows,
} from "./migrate-local";
import { loadState } from "../persistence";
import { enqueueLatest, pending, remove } from "./queue";

type PerProfile<T> = Record<ProfileId, T>;

/**
 * The one-time localStorage -> Supabase import (T-023).
 *
 * OFF since 2026-07-25. It completed for the real household, and the store no
 * longer produces any demo state, so the only payload it could still build is a
 * stale pre-fix demo snapshot left in a browser. Importing that would recreate
 * exactly the mock rows the cleanup migration deletes. The transform itself is
 * kept (pure and unit-tested) so the import can be re-enabled deliberately if a
 * genuine local-only dataset ever has to be brought into the cloud.
 */
const LOCAL_IMPORT_ENABLED = false;

interface Args {
  days: PerProfile<Record<string, DayData>>;
  setDays: Dispatch<SetStateAction<PerProfile<Record<string, DayData>>>>;
  weighInsMap: PerProfile<WeighIn[]>;
  setWeighInsMap: Dispatch<SetStateAction<PerProfile<WeighIn[]>>>;
  foods: Food[];
  setFoods: Dispatch<SetStateAction<Food[]>>;
  setFavoritesMap: Dispatch<SetStateAction<PerProfile<string[]>>>;
  setRecentsMap: Dispatch<SetStateAction<PerProfile<string[]>>>;
  stepGoals: PerProfile<number>;
  setStepGoals: Dispatch<SetStateAction<PerProfile<number>>>;
  activeProfile: ProfileId;
  iso: string;
  setSyncState: (s: SyncState) => void;
}

export interface SyncControls {
  /** True once Supabase is the active source of truth (disables localStorage). */
  active: boolean;
  markDayDirty: (profile: ProfileId, iso: string) => void;
  markWeighDirty: (profile: ProfileId) => void;
  markFoodDirty: (food: Food) => void;
  markFavoriteDirty: (profile: ProfileId, foodId: string, isFavorite: boolean) => void;
  markRecentDirty: (profile: ProfileId, foodId: string, whenISO: string) => void;
  markStepsDirty: (profile: ProfileId, iso: string, report: DailySteps) => void;
  markStepGoalDirty: (profile: ProfileId, goal: number) => void;
}

export function useSupabaseSync(args: Args): SyncControls {
  const {
    setDays,
    setWeighInsMap,
    setFoods,
    setFavoritesMap,
    setRecentsMap,
    setStepGoals,
    activeProfile,
    iso,
    setSyncState,
  } = args;
  const [active, setActive] = useState(false);
  const ctxRef = useRef<HouseholdContext | null>(null);
  const dirtyDays = useRef<Set<string>>(new Set());
  const inFlightDays = useRef<Set<string>>(new Set());
  const dirtyWeigh = useRef<Set<ProfileId>>(new Set());
  const dirtyFoods = useRef<Map<string, Food>>(new Map());
  const dirtyPrefs = useRef<Map<string, PrefMutation & { profile: ProfileId }>>(new Map());
  const dirtySteps = useRef<Map<string, DailySteps>>(new Map());
  const inFlightSteps = useRef<Set<string>>(new Set());
  const dirtyStepGoals = useRef<Map<ProfileId, number>>(new Map());
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest state + current view, readable from async callbacks without re-subscribing.
  const daysRef = useRef(args.days);
  const weighRef = useRef(args.weighInsMap);
  const foodsRef = useRef(args.foods);
  const viewRef = useRef({ profile: activeProfile, iso });
  daysRef.current = args.days;
  weighRef.current = args.weighInsMap;
  foodsRef.current = args.foods;
  viewRef.current = { profile: activeProfile, iso };

  // Reconcile the remote catalog with the built-in list. Always merged from
  // BUILT_IN_FOODS (not from previous state) so a row deleted or archived
  // remotely actually disappears instead of lingering from an earlier hydrate.
  const hydrateFoodsList = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      const remote = await hydrateFoods(ctx);
      setFoods(mergeCatalog(BUILT_IN_FOODS, remote));
    } catch (err) {
      console.warn("hydrate foods failed", err);
    }
  }, [setFoods]);

  // Favorites + recents for a profile come only from that profile's preferences.
  const hydratePrefsFor = useCallback(
    async (profile: ProfileId) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      // Don't clobber an in-flight optimistic change for this profile.
      for (const m of dirtyPrefs.current.values()) if (m.profile === profile) return;
      try {
        const prefs = await hydratePreferences(ctx, profile);
        const { favorites, recents } = deriveFavoritesRecents(prefs);
        setFavoritesMap((prev) => ({ ...prev, [profile]: favorites }));
        setRecentsMap((prev) => ({ ...prev, [profile]: recents }));
      } catch (err) {
        console.warn("hydrate prefs failed", err);
      }
    },
    [setFavoritesMap, setRecentsMap],
  );

  const hydrate = useCallback(
    async (profile: ProfileId, isoDate: string) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      try {
        const day = await hydrateDay(ctx, profile, isoDate);
        // Never overwrite a day/weigh-in that has a pending or in-flight local
        // push — the optimistic state is newer than what Supabase returns.
        const dayKey = `${profile}::${isoDate}`;
        if (
          day &&
          !dirtyDays.current.has(dayKey) &&
          !inFlightDays.current.has(dayKey) &&
          !dirtySteps.current.has(dayKey) &&
          !inFlightSteps.current.has(dayKey)
        ) {
          setDays((prev) => ({ ...prev, [profile]: { ...prev[profile], [isoDate]: day } }));
        } else if (day && dirtySteps.current.has(dayKey)) {
          setDays((prev) => ({
            ...prev,
            [profile]: {
              ...prev[profile],
              [isoDate]: { ...day, steps: prev[profile][isoDate]?.steps },
            },
          }));
        }
        const pid = profileIdFor(ctx, profile);
        if (pid && !dirtyWeigh.current.has(profile)) {
          const w = await loadWeighIns(pid);
          setWeighInsMap((prev) => ({ ...prev, [profile]: w }));
        }
        await hydratePrefsFor(profile);
        if (!dirtyStepGoals.current.has(profile)) {
          const goal = await hydrateStepGoal(ctx, profile);
          setStepGoals((prev) => ({ ...prev, [profile]: goal }));
        }
      } catch (err) {
        console.warn("hydrate failed", err);
        setSyncState("error");
      }
    },
    [setDays, setWeighInsMap, setSyncState, hydratePrefsFor, setStepGoals],
  );

  // Activation: session -> bootstrap -> migration -> initial hydrate -> realtime.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let disposed = false;
    let unsubRealtime: (() => void) | null = null;

    async function activate() {
      const session = await getSession();
      if (!session || disposed || ctxRef.current) return;
      try {
        setSyncState("saving");
        const ctx = await bootstrapHousehold();
        if (disposed) return;
        ctxRef.current = ctx;
        for (const mutation of pending()) {
          if (mutation.entity === "daily_step_logs") {
            const payload = mutation.payload as {
              profile: ProfileId;
              iso: string;
              report: DailySteps;
            };
            dirtySteps.current.set(`${payload.profile}::${payload.iso}`, payload.report);
          } else if (mutation.entity === "profile_step_settings") {
            const payload = mutation.payload as { profile: ProfileId; goal: number };
            dirtyStepGoals.current.set(payload.profile, payload.goal);
          }
        }

        // The one-time localStorage -> cloud import is RETIRED (see
        // LOCAL_IMPORT_ENABLED). It has already run for this household, and the
        // only thing a browser can still be holding is a pre-fix demo snapshot —
        // re-importing that would put mock rows back into the cloud right after
        // the cleanup migration removed them. Markers are still set so the import
        // can never fire even if it is re-enabled on an old profile.
        if (LOCAL_IMPORT_ENABLED) {
          const local = loadState();
          if (!isMigrated()) {
            if (local) {
              const payload = buildMigrationPayload(local, ctx.householdId, ctx.profileIdBySlug);
              if (totalRows(payload) > 0) await uploadMigration(payload);
            }
          }
          if (!isFoodsMigrated()) {
            if (local) {
              const fp = buildFoodMigrationPayload(local, ctx.householdId, ctx.profileIdBySlug);
              if (totalFoodRows(fp) > 0) await uploadFoodMigration(fp);
            }
          }
        }
        if (!isMigrated()) markMigrated();
        if (!isFoodsMigrated()) markFoodsMigrated();

        setActive(true);
        await hydrateFoodsList();
        await hydrate(viewRef.current.profile, viewRef.current.iso);
        setSyncState("saved");

        unsubRealtime = subscribeHousehold(
          ctx,
          (table) => {
            if (table === "foods") void hydrateFoodsList();
            else if (table === "food_preferences") void hydratePrefsFor(viewRef.current.profile);
            else void hydrate(viewRef.current.profile, viewRef.current.iso);
          },
          session.access_token,
        );
      } catch (err) {
        console.warn("supabase activation failed", err);
        setSyncState("error");
      }
    }

    void activate();
    const unsubAuth = onAuthChange((s) => {
      if (!s) {
        setActive(false);
        ctxRef.current = null;
      } else {
        void activate();
      }
    });
    // Retry activation if it was interrupted (e.g. offline during bootstrap).
    const onOnline = () => {
      if (!ctxRef.current) void activate();
    };
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      unsubAuth();
      unsubRealtime?.();
      window.removeEventListener("online", onOnline);
    };
  }, [hydrate, hydrateFoodsList, hydratePrefsFor, setSyncState]);

  // Hydrate when the viewed profile/date changes.
  useEffect(() => {
    if (!active) return;
    void hydrate(activeProfile, iso);
  }, [active, activeProfile, iso, hydrate]);

  const flush = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    // Snapshot + clear; on failure (e.g. offline) re-queue so nothing is lost
    // and the next flush / reconnect retries. Idempotent upserts prevent dupes.
    const dayKeys = [...dirtyDays.current];
    // Move days to in-flight (still protected from hydrate) rather than clearing,
    // so a concurrent reload can't wipe the optimistic state mid-push.
    dirtyDays.current.clear();
    for (const k of dayKeys) inFlightDays.current.add(k);
    const weighProfiles = [...dirtyWeigh.current];
    dirtyWeigh.current.clear();
    const foods = [...dirtyFoods.current.values()];
    dirtyFoods.current.clear();
    const prefs = [...dirtyPrefs.current.values()];
    dirtyPrefs.current.clear();
    const steps = [...dirtySteps.current.entries()];
    dirtySteps.current.clear();
    for (const [key] of steps) inFlightSteps.current.add(key);
    const stepGoals = [...dirtyStepGoals.current.entries()];
    dirtyStepGoals.current.clear();

    const requeue = () => {
      for (const k of dayKeys) dirtyDays.current.add(k);
      for (const p of weighProfiles) dirtyWeigh.current.add(p);
      for (const f of foods) if (!dirtyFoods.current.has(f.id)) dirtyFoods.current.set(f.id, f);
      for (const p of prefs) {
        const key = `${p.profile}::${p.foodId}`;
        if (!dirtyPrefs.current.has(key)) dirtyPrefs.current.set(key, p);
      }
      for (const [key, report] of steps)
        if (!dirtySteps.current.has(key)) dirtySteps.current.set(key, report);
      for (const [profile, goal] of stepGoals)
        if (!dirtyStepGoals.current.has(profile)) dirtyStepGoals.current.set(profile, goal);
    };

    void (async () => {
      try {
        setSyncState("saving");
        if (foods.length) await pushFoods(ctx, foods);
        for (const key of dayKeys) {
          const [profile, isoDate] = key.split("::") as [ProfileId, string];
          const day = daysRef.current[profile]?.[isoDate];
          if (day) await pushDay(ctx, profile, isoDate, day);
        }
        for (const profile of weighProfiles) {
          const pid = profileIdFor(ctx, profile);
          if (!pid) continue;
          const remote = await loadWeighIns(pid);
          const remoteIds = new Set(remote.map((r) => r.id));
          for (const w of weighRef.current[profile] ?? []) {
            if (!remoteIds.has(w.id)) await insertWeighIn(ctx.householdId, pid, w);
          }
        }
        // Preferences grouped by profile.
        const byProfile = new Map<ProfileId, PrefMutation[]>();
        for (const p of prefs) {
          const list = byProfile.get(p.profile) ?? [];
          list.push({ foodId: p.foodId, isFavorite: p.isFavorite, recentAt: p.recentAt });
          byProfile.set(p.profile, list);
        }
        for (const [profile, mutations] of byProfile) {
          await pushPreferences(ctx, profile, mutations);
        }
        for (const [key, report] of steps) {
          const [profile, isoDate] = key.split("::") as [ProfileId, string];
          await pushDailySteps(ctx, profile, isoDate, report);
          inFlightSteps.current.delete(key);
          for (const mutation of pending()) {
            if (
              mutation.entity === "daily_step_logs" &&
              (mutation.payload as { key?: string }).key === key
            )
              remove(mutation.id);
          }
        }
        for (const [profile, goal] of stepGoals) {
          await pushStepGoal(ctx, profile, goal);
          for (const mutation of pending()) {
            if (mutation.entity === "profile_step_settings" && mutation.profileId === profile)
              remove(mutation.id);
          }
        }
        for (const k of dayKeys) inFlightDays.current.delete(k);
        for (const [key] of steps) inFlightSteps.current.delete(key);
        setSyncState("saved");
      } catch (err) {
        console.warn("push failed — re-queued for retry", err);
        for (const k of dayKeys) inFlightDays.current.delete(k);
        for (const [key] of steps) inFlightSteps.current.delete(key);
        requeue();
        setSyncState("error");
      }
    })();
  }, [setSyncState]);

  const schedule = useCallback(() => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(flush, 700);
  }, [flush]);

  // Flush any re-queued (failed/offline) mutations when connectivity returns.
  // The "online" event is the fast path; a short interval is the reliable
  // fallback (some environments don't fire it) and no-ops when nothing pending.
  useEffect(() => {
    if (!active) return;
    const hasPending = () =>
      dirtyDays.current.size > 0 ||
      dirtyWeigh.current.size > 0 ||
      dirtyFoods.current.size > 0 ||
      dirtyPrefs.current.size > 0 ||
      dirtySteps.current.size > 0 ||
      dirtyStepGoals.current.size > 0;
    const onOnline = () => schedule();
    window.addEventListener("online", onOnline);
    const id = setInterval(() => {
      if (hasPending()) schedule();
    }, 3000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(id);
    };
  }, [active, schedule]);

  // Record dirty whenever Supabase is configured — even during the activation
  // window before `active` flips true — so a mutation made right after load is
  // protected from the initial hydrate and flushed once the context is ready.
  const markDayDirty = useCallback(
    (profile: ProfileId, isoDate: string) => {
      if (!isSupabaseConfigured()) return;
      dirtyDays.current.add(`${profile}::${isoDate}`);
      schedule();
    },
    [schedule],
  );

  const markWeighDirty = useCallback(
    (profile: ProfileId) => {
      if (!isSupabaseConfigured()) return;
      dirtyWeigh.current.add(profile);
      schedule();
    },
    [schedule],
  );

  const markFoodDirty = useCallback(
    (food: Food) => {
      // Only custom foods are synced (built-in catalog is a client constant).
      if (!isSupabaseConfigured() || !isCustomFoodId(food.id)) return;
      dirtyFoods.current.set(food.id, food);
      schedule();
    },
    [schedule],
  );

  const markFavoriteDirty = useCallback(
    (profile: ProfileId, foodId: string, isFavorite: boolean) => {
      if (!isSupabaseConfigured()) return;
      const key = `${profile}::${foodId}`;
      const prev = dirtyPrefs.current.get(key) ?? { profile, foodId };
      dirtyPrefs.current.set(key, { ...prev, isFavorite });
      schedule();
    },
    [schedule],
  );

  const markRecentDirty = useCallback(
    (profile: ProfileId, foodId: string, whenISO: string) => {
      if (!isSupabaseConfigured()) return;
      const key = `${profile}::${foodId}`;
      const prev = dirtyPrefs.current.get(key) ?? { profile, foodId };
      dirtyPrefs.current.set(key, { ...prev, recentAt: whenISO });
      schedule();
    },
    [schedule],
  );

  const markStepsDirty = useCallback(
    (profile: ProfileId, isoDate: string, report: DailySteps) => {
      if (!isSupabaseConfigured()) return;
      dirtySteps.current.set(`${profile}::${isoDate}`, report);
      const ctx = ctxRef.current;
      enqueueLatest(
        {
          id: crypto.randomUUID(),
          type: "upsert",
          entity: "daily_step_logs",
          payload: { profile, iso: isoDate, report },
          householdId: ctx?.householdId ?? "pending-bootstrap",
          profileId: profile,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        },
        `${profile}::${isoDate}`,
      );
      schedule();
    },
    [schedule],
  );

  const markStepGoalDirty = useCallback(
    (profile: ProfileId, goal: number) => {
      if (!isSupabaseConfigured()) return;
      dirtyStepGoals.current.set(profile, goal);
      const ctx = ctxRef.current;
      enqueueLatest(
        {
          id: crypto.randomUUID(),
          type: "upsert",
          entity: "profile_step_settings",
          payload: { profile, goal },
          householdId: ctx?.householdId ?? "pending-bootstrap",
          profileId: profile,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        },
        profile,
      );
      schedule();
    },
    [schedule],
  );

  return {
    active,
    markDayDirty,
    markWeighDirty,
    markFoodDirty,
    markFavoriteDirty,
    markRecentDirty,
    markStepsDirty,
    markStepGoalDirty,
  };
}

async function uploadFoodMigration(
  payload: ReturnType<typeof buildFoodMigrationPayload>,
): Promise<void> {
  const sb = requireSupabase();
  if (payload.foods.length) {
    await sb.from("foods").upsert(payload.foods, { onConflict: "household_id,normalized_name" });
  }
  if (payload.preferences.length) {
    await sb
      .from("food_preferences")
      .upsert(payload.preferences, { onConflict: "profile_id,food_id" });
  }
}

async function uploadMigration(payload: ReturnType<typeof buildMigrationPayload>): Promise<void> {
  const sb = requireSupabase();
  if (payload.mealStatuses.length) {
    await sb
      .from("meal_statuses")
      .upsert(payload.mealStatuses, { onConflict: "profile_id,log_date,slot" });
  }
  // DB generates entry ids for the one-time import (legacy ids aren't UUIDs).
  if (payload.foodEntries.length) {
    const rows = payload.foodEntries.map(({ id: _id, ...rest }) => rest);
    await sb.from("food_entries").insert(rows);
  }
  if (payload.fasting.length) {
    await sb.from("fasting_logs").upsert(payload.fasting, { onConflict: "profile_id,log_date" });
  }
  if (payload.workouts.length) {
    await sb.from("workout_logs").upsert(payload.workouts, { onConflict: "profile_id,log_date" });
  }
  if (payload.weighIns.length) {
    await sb.from("weigh_ins").insert(payload.weighIns);
  }
}
