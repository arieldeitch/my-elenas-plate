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
import type { DayData, Food, ProfileId, SyncState, WeighIn } from "../domain";
import { isSupabaseConfigured, requireSupabase } from "../supabase/client";
import { getSession, onAuthChange } from "../supabase/auth";
import {
  bootstrapHousehold,
  insertWeighIn,
  loadWeighIns,
  type HouseholdContext,
} from "../supabase/repositories";
import { deriveFavoritesRecents } from "../supabase/mappers";
import {
  hydrateDay,
  hydrateFoods,
  hydratePreferences,
  profileIdFor,
  pushDay,
  pushFoods,
  pushPreferences,
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

type PerProfile<T> = Record<ProfileId, T>;

interface Args {
  days: PerProfile<Record<string, DayData>>;
  setDays: Dispatch<SetStateAction<PerProfile<Record<string, DayData>>>>;
  weighInsMap: PerProfile<WeighIn[]>;
  setWeighInsMap: Dispatch<SetStateAction<PerProfile<WeighIn[]>>>;
  foods: Food[];
  setFoods: Dispatch<SetStateAction<Food[]>>;
  setFavoritesMap: Dispatch<SetStateAction<PerProfile<string[]>>>;
  setRecentsMap: Dispatch<SetStateAction<PerProfile<string[]>>>;
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
}

export function useSupabaseSync(args: Args): SyncControls {
  const {
    setDays,
    setWeighInsMap,
    setFoods,
    setFavoritesMap,
    setRecentsMap,
    activeProfile,
    iso,
    setSyncState,
  } = args;
  const [active, setActive] = useState(false);
  const ctxRef = useRef<HouseholdContext | null>(null);
  const dirtyDays = useRef<Set<string>>(new Set());
  const dirtyWeigh = useRef<Set<ProfileId>>(new Set());
  const dirtyFoods = useRef<Map<string, Food>>(new Map());
  const dirtyPrefs = useRef<Map<string, PrefMutation & { profile: ProfileId }>>(new Map());
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

  // Merge remote custom foods into the catalog, preserving built-in + local ones.
  const hydrateFoodsList = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      const remote = await hydrateFoods(ctx);
      setFoods((prev) => {
        const have = new Set(prev.map((f) => f.id));
        const extra = remote.filter((f) => !have.has(f.id));
        return extra.length ? [...extra, ...prev] : prev;
      });
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
        if (day) {
          setDays((prev) => ({ ...prev, [profile]: { ...prev[profile], [isoDate]: day } }));
        }
        const pid = profileIdFor(ctx, profile);
        if (pid) {
          const w = await loadWeighIns(pid);
          setWeighInsMap((prev) => ({ ...prev, [profile]: w }));
        }
        await hydratePrefsFor(profile);
      } catch (err) {
        console.warn("hydrate failed", err);
        setSyncState("error");
      }
    },
    [setDays, setWeighInsMap, setSyncState, hydratePrefsFor],
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

        const local = loadState();
        if (!isMigrated()) {
          if (local) {
            const payload = buildMigrationPayload(local, ctx.householdId, ctx.profileIdBySlug);
            if (totalRows(payload) > 0) await uploadMigration(payload);
          }
          markMigrated();
        }
        // Independent marker so users who already ran the meal-data migration
        // still import custom foods + favorites/recents exactly once.
        if (!isFoodsMigrated()) {
          if (local) {
            const fp = buildFoodMigrationPayload(local, ctx.householdId, ctx.profileIdBySlug);
            if (totalFoodRows(fp) > 0) await uploadFoodMigration(fp);
          }
          markFoodsMigrated();
        }

        setActive(true);
        await hydrateFoodsList();
        await hydrate(viewRef.current.profile, viewRef.current.iso);
        setSyncState("saved");

        unsubRealtime = subscribeHousehold(ctx, (table) => {
          if (table === "foods") void hydrateFoodsList();
          else if (table === "food_preferences") void hydratePrefsFor(viewRef.current.profile);
          else void hydrate(viewRef.current.profile, viewRef.current.iso);
        });
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
    return () => {
      disposed = true;
      unsubAuth();
      unsubRealtime?.();
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
    const dayKeys = [...dirtyDays.current];
    dirtyDays.current.clear();
    const weighProfiles = [...dirtyWeigh.current];
    dirtyWeigh.current.clear();
    const foods = [...dirtyFoods.current.values()];
    dirtyFoods.current.clear();
    const prefs = [...dirtyPrefs.current.values()];
    dirtyPrefs.current.clear();

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
        setSyncState("saved");
      } catch (err) {
        console.warn("push failed", err);
        setSyncState("error");
      }
    })();
  }, [setSyncState]);

  const schedule = useCallback(() => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(flush, 700);
  }, [flush]);

  const markDayDirty = useCallback(
    (profile: ProfileId, isoDate: string) => {
      if (!active) return;
      dirtyDays.current.add(`${profile}::${isoDate}`);
      schedule();
    },
    [active, schedule],
  );

  const markWeighDirty = useCallback(
    (profile: ProfileId) => {
      if (!active) return;
      dirtyWeigh.current.add(profile);
      schedule();
    },
    [active, schedule],
  );

  const markFoodDirty = useCallback(
    (food: Food) => {
      // Only custom foods are synced (built-in catalog is a client constant).
      if (!active || !isCustomFoodId(food.id)) return;
      dirtyFoods.current.set(food.id, food);
      schedule();
    },
    [active, schedule],
  );

  const markFavoriteDirty = useCallback(
    (profile: ProfileId, foodId: string, isFavorite: boolean) => {
      if (!active) return;
      const key = `${profile}::${foodId}`;
      const prev = dirtyPrefs.current.get(key) ?? { profile, foodId };
      dirtyPrefs.current.set(key, { ...prev, isFavorite });
      schedule();
    },
    [active, schedule],
  );

  const markRecentDirty = useCallback(
    (profile: ProfileId, foodId: string, whenISO: string) => {
      if (!active) return;
      const key = `${profile}::${foodId}`;
      const prev = dirtyPrefs.current.get(key) ?? { profile, foodId };
      dirtyPrefs.current.set(key, { ...prev, recentAt: whenISO });
      schedule();
    },
    [active, schedule],
  );

  return {
    active,
    markDayDirty,
    markWeighDirty,
    markFoodDirty,
    markFavoriteDirty,
    markRecentDirty,
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
