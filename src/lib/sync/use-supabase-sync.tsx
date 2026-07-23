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
import type { DayData, ProfileId, SyncState, WeighIn } from "../domain";
import { isSupabaseConfigured, requireSupabase } from "../supabase/client";
import { getSession, onAuthChange } from "../supabase/auth";
import {
  bootstrapHousehold,
  insertWeighIn,
  loadWeighIns,
  type HouseholdContext,
} from "../supabase/repositories";
import { hydrateDay, profileIdFor, pushDay, subscribeHousehold } from "./supabase-sync";
import { buildMigrationPayload, isMigrated, markMigrated, totalRows } from "./migrate-local";
import { loadState } from "../persistence";

type PerProfile<T> = Record<ProfileId, T>;

interface Args {
  days: PerProfile<Record<string, DayData>>;
  setDays: Dispatch<SetStateAction<PerProfile<Record<string, DayData>>>>;
  weighInsMap: PerProfile<WeighIn[]>;
  setWeighInsMap: Dispatch<SetStateAction<PerProfile<WeighIn[]>>>;
  activeProfile: ProfileId;
  iso: string;
  setSyncState: (s: SyncState) => void;
}

export interface SyncControls {
  /** True once Supabase is the active source of truth (disables localStorage). */
  active: boolean;
  markDayDirty: (profile: ProfileId, iso: string) => void;
  markWeighDirty: (profile: ProfileId) => void;
}

export function useSupabaseSync(args: Args): SyncControls {
  const { setDays, setWeighInsMap, activeProfile, iso, setSyncState } = args;
  const [active, setActive] = useState(false);
  const ctxRef = useRef<HouseholdContext | null>(null);
  const dirtyDays = useRef<Set<string>>(new Set());
  const dirtyWeigh = useRef<Set<ProfileId>>(new Set());
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest state + current view, readable from async callbacks without re-subscribing.
  const daysRef = useRef(args.days);
  const weighRef = useRef(args.weighInsMap);
  const viewRef = useRef({ profile: activeProfile, iso });
  daysRef.current = args.days;
  weighRef.current = args.weighInsMap;
  viewRef.current = { profile: activeProfile, iso };

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
      } catch (err) {
        console.warn("hydrate failed", err);
        setSyncState("error");
      }
    },
    [setDays, setWeighInsMap, setSyncState],
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

        if (!isMigrated()) {
          const local = loadState();
          if (local) {
            const payload = buildMigrationPayload(local, ctx.householdId, ctx.profileIdBySlug);
            if (totalRows(payload) > 0) await uploadMigration(payload);
          }
          markMigrated();
        }

        setActive(true);
        await hydrate(viewRef.current.profile, viewRef.current.iso);
        setSyncState("saved");

        unsubRealtime = subscribeHousehold(ctx, () => {
          void hydrate(viewRef.current.profile, viewRef.current.iso);
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
  }, [hydrate, setSyncState]);

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

    void (async () => {
      try {
        setSyncState("saving");
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

  return { active, markDayDirty, markWeighDirty };
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
