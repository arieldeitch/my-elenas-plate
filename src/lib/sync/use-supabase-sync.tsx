/**
 * React glue that activates Supabase sync inside the store — ONLY when Supabase
 * is configured and a session exists. In demo mode every effect returns early,
 * so the local app and its tests are completely unaffected.
 *
 * Responsibilities when active (M1 shared-truth recovery):
 *  - bootstrap the shared household + two profiles (idempotent RPC)
 *  - hydrate the current profile/date day + weigh-ins + prefs from Supabase
 *  - accept OPERATIONS from the store, persist them in the durable queue
 *    (localStorage) and drain them in order to Supabase — each op is a narrow,
 *    idempotent write; there is no whole-day snapshot reconciliation here
 *  - subscribe to realtime for every mutable table and re-hydrate the affected
 *    profile/date, never clobbering a day that still has unsent local ops
 *  - derive the UI sync state from the queue: "saved" only when the queue is
 *    empty; pending/failed ops are always visible
 *
 * All network work is wrapped defensively; failures keep the optimistic local
 * state and the queued ops intact.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  partnerOf,
  type DayData,
  type Dish,
  type EstimatedProduct,
  type Food,
  type ProfileId,
  type SyncState,
  type WeightBridge,
  type WeighIn,
} from "../domain";
import { isSupabaseConfigured } from "../supabase/client";
import type { ProfileFacts } from "../points";
import { getSession, onAuthChange } from "../supabase/auth";
import {
  bootstrapHousehold,
  foodsSchemaSupportsReferenceLink,
  isMissingRelation,
  loadDishes,
  loadEstimatedProducts,
  loadProfileFacts,
  loadWeighIns,
  loadWeightBridges,
  type HouseholdContext,
} from "../supabase/repositories";
import { deriveFavoritesRecents } from "../supabase/mappers";
import { BUILT_IN_FOODS, mergeCatalog } from "../food-catalog";
import {
  applyOperation,
  hydrateDay,
  hydrateFoods,
  hydratePreferences,
  profileIdFor,
  subscribeHousehold,
  type RealtimeChange,
  type RealtimeStatus,
} from "./supabase-sync";
import { isFoodsMigrated, isMigrated, markFoodsMigrated, markMigrated } from "./migrate-local";
import { dayKey, dayKeyOf, type Operation } from "./operations";
import * as queue from "./queue";
import { drainQueue } from "./drain";

type PerProfile<T> = Record<ProfileId, T>;

interface Args {
  days: PerProfile<Record<string, DayData>>;
  setDays: Dispatch<SetStateAction<PerProfile<Record<string, DayData>>>>;
  weighInsMap: PerProfile<WeighIn[]>;
  setWeighInsMap: Dispatch<SetStateAction<PerProfile<WeighIn[]>>>;
  foods: Food[];
  setDishes: Dispatch<SetStateAction<Dish[]>>;
  setEstimatedProducts: Dispatch<SetStateAction<EstimatedProduct[]>>;
  setWeightBridges: Dispatch<SetStateAction<WeightBridge[]>>;
  setFoods: Dispatch<SetStateAction<Food[]>>;
  setFavoritesMap: Dispatch<SetStateAction<PerProfile<string[]>>>;
  setRecentsMap: Dispatch<SetStateAction<PerProfile<string[]>>>;
  setProfileFactsMap: Dispatch<SetStateAction<PerProfile<ProfileFacts>>>;
  activeProfile: ProfileId;
  iso: string;
  setSyncState: (s: SyncState) => void;
  setSyncDetail: (d: SyncDetail) => void;
}

export interface SyncDetail {
  /** Ops persisted locally but not yet confirmed by Supabase. */
  pending: number;
  /** Ops Supabase rejected permanently; visible until retried or discarded. */
  failed: number;
  /** Realtime channel state: "off" until activation, then the channel status. */
  realtime: "off" | RealtimeStatus;
}

export const INITIAL_SYNC_DETAIL: SyncDetail = { pending: 0, failed: 0, realtime: "off" };

export interface SyncControls {
  /** True once Supabase is the active source of truth (disables localStorage). */
  active: boolean;
  /** Persists operations durably and schedules a drain. No-op in demo mode. */
  enqueue: (ops: Operation[]) => void;
  /** Re-queues permanently failed ops for another attempt. */
  retryFailed: () => void;
  /** Drops permanently failed ops (local optimistic state is kept). */
  discardFailed: () => void;
  /** Cloud schema capabilities detected on activation (DEC-036, DEC-037). */
  schema: { referenceGroupKey: boolean; dishes: boolean };
}

const WEIGH_KINDS = new Set(["weighin.insert"]);
const PREF_KINDS = new Set(["pref.favorite", "pref.recent"]);
const PROFILE_FACTS_KINDS = new Set(["profile.points-budget.set", "profile.facts.set"]);
const DRAIN_DEBOUNCE_MS = 400;
/**
 * Converging a day from the cloud after our own drain and after each realtime
 * echo of the rows we just wrote would fetch the same day three or four times
 * within a few hundred ms. Day re-reads are coalesced per profile/date instead.
 */
const DAY_CONVERGE_MS = 150;
const RETRY_INTERVAL_MS = 3000;
const ACTIVATION_RETRY_MS = [3000, 6000, 12000, 30000];

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function useSupabaseSync(args: Args): SyncControls {
  const {
    setDays,
    setWeighInsMap,
    setFoods,
    setFavoritesMap,
    setRecentsMap,
    setProfileFactsMap,
    activeProfile,
    iso,
    setSyncState,
    setSyncDetail,
  } = args;
  const [active, setActive] = useState(false);
  const ctxRef = useRef<HouseholdContext | null>(null);
  const userIdRef = useRef<string | undefined>(undefined);
  const draining = useRef(false);
  const drainAgain = useRef(false);
  const inFlightDay = useRef<string | null>(null);
  // The view (profile::iso) that activation itself hydrated, so the view
  // effect does not fetch the same day a second time right after activation.
  const hydratedAtActivation = useRef<string | null>(null);
  const drainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeRef = useRef<SyncDetail["realtime"]>("off");

  // Latest state + current view, readable from async callbacks without re-subscribing.
  const daysRef = useRef(args.days);
  const viewRef = useRef({ profile: activeProfile, iso });
  daysRef.current = args.days;
  viewRef.current = { profile: activeProfile, iso };

  // --- sync state derived from the durable queue -----------------------------
  const publishState = useCallback(
    (phase: "idle" | "draining" | "error" = "idle") => {
      const pendingCount = queue.pending().length;
      const failedCount = queue.quarantined().length;
      setSyncDetail({ pending: pendingCount, failed: failedCount, realtime: realtimeRef.current });
      if (failedCount > 0 || phase === "error") setSyncState("error");
      else if (phase === "draining") setSyncState("saving");
      else if (pendingCount > 0) setSyncState(isOnline() ? "pending" : "offline");
      else setSyncState("saved");
    },
    [setSyncDetail, setSyncState],
  );

  // --- hydration ----------------------------------------------------------------
  // Reconcile the remote catalog with the built-in list. Always merged from
  // BUILT_IN_FOODS (not from previous state) so a row deleted or archived
  // remotely actually disappears instead of lingering from an earlier hydrate.
  // DEC-036: personal aliases need `foods.reference_group_key`; until the
  // cloud confirms the column, the store refuses to create them (no silent
  // queue failure). Only a definite "column missing" turns it off.
  const [schemaReferenceGroupKey, setSchemaReferenceGroupKey] = useState(true);
  // DEC-037: the dishes / estimated products / bridges tables. Until the
  // migration is applied the UI explains it instead of queueing a doomed write.
  const [schemaDishes, setSchemaDishes] = useState(true);

  /**
   * Household-wide DEC-037 entities. Hydrated together (they are small and
   * always read as a set) and re-read on any realtime event of their tables,
   * which also makes a partner's new dish appear without a reload.
   */
  const hydrateDerived = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const localById = new Map<string, ProfileId>();
    for (const local of ["me", "elena"] as ProfileId[]) {
      const id = profileIdFor(ctx, local);
      if (id) localById.set(id, local);
    }
    try {
      // Three parallel reads; their own failure is the schema probe, so the
      // activation costs no extra round trip before the migration is applied.
      const [dishes, products, bridges] = await Promise.all([
        loadDishes(ctx.householdId, localById),
        loadEstimatedProducts(ctx.householdId, localById),
        loadWeightBridges(ctx.householdId, localById),
      ]);
      setSchemaDishes(true);
      args.setDishes(dishes);
      args.setEstimatedProducts(products);
      args.setWeightBridges(bridges);
    } catch (err) {
      // "relation does not exist" = the migration is not applied yet; the UI
      // then explains it instead of queueing a write that can never succeed.
      if (isMissingRelation(err)) setSchemaDishes(false);
      else console.warn("hydrate dishes/estimated/bridges failed", err);
    }
    // args setters are stable state setters from the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hydrateFoodsList = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      const remote = await hydrateFoods(ctx);
      setFoods(mergeCatalog(BUILT_IN_FOODS, remote));
      const supported = await foodsSchemaSupportsReferenceLink(ctx.householdId);
      if (supported != null) setSchemaReferenceGroupKey(supported);
    } catch (err) {
      console.warn("hydrate foods failed", err);
    }
  }, [setFoods]);

  // Favorites + recents for a profile come only from that profile's preferences.
  const hydratePrefsFor = useCallback(
    async (profile: ProfileId) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      // Don't clobber an unsent optimistic change for this profile.
      if (queue.hasPendingForProfile(profile, PREF_KINDS)) return;
      try {
        const prefs = await hydratePreferences(ctx, profile);
        if (queue.hasPendingForProfile(profile, PREF_KINDS)) return;
        const { favorites, recents } = deriveFavoritesRecents(prefs);
        setFavoritesMap((prev) => ({ ...prev, [profile]: favorites }));
        setRecentsMap((prev) => ({ ...prev, [profile]: recents }));
      } catch (err) {
        console.warn("hydrate prefs failed", err);
      }
    },
    [setFavoritesMap, setRecentsMap],
  );

  const hydrateWeighInsFor = useCallback(
    async (profile: ProfileId) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const pid = profileIdFor(ctx, profile);
      if (!pid || queue.hasPendingForProfile(profile, WEIGH_KINDS)) return;
      try {
        const w = await loadWeighIns(pid);
        if (queue.hasPendingForProfile(profile, WEIGH_KINDS)) return;
        setWeighInsMap((prev) => ({ ...prev, [profile]: w }));
      } catch (err) {
        console.warn("hydrate weigh-ins failed", err);
      }
    },
    [setWeighInsMap],
  );

  // Profile facts (sex / birth date / height / goal / override) for BOTH
  // profiles in one read; a profile with an unsent local change keeps it.
  const hydrateProfileFacts = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      const remote = await loadProfileFacts(ctx.householdId);
      setProfileFactsMap((prev) => {
        const next = { ...prev };
        if (!queue.hasPendingForProfile("me", PROFILE_FACTS_KINDS) && remote.ariel)
          next.me = remote.ariel;
        if (!queue.hasPendingForProfile("elena", PROFILE_FACTS_KINDS) && remote.alena)
          next.elena = remote.alena;
        return next;
      });
    } catch (err) {
      console.warn("hydrate profile facts failed", err);
    }
  }, [setProfileFactsMap]);

  /**
   * Loads one profile/date from Supabase into the store. A day with unsent or
   * in-flight local ops is left alone: the optimistic state is newer than what
   * Supabase returns, and the realtime echo after the drain will converge it.
   */
  const hydrateDayOnly = useCallback(
    async (profile: ProfileId, isoDate: string): Promise<boolean> => {
      const ctx = ctxRef.current;
      if (!ctx) return false;
      const key = dayKey(profile, isoDate);
      const guarded = () => queue.pendingDayKeys().has(key) || inFlightDay.current === key;
      if (guarded()) return false;
      const day = await hydrateDay(ctx, profile, isoDate);
      if (!day || guarded()) return false;
      setDays((prev) => ({ ...prev, [profile]: { ...prev[profile], [isoDate]: day } }));
      return true;
    },
    [setDays],
  );

  // Coalesced day re-read (post-drain converge + realtime echoes → one fetch).
  const convergeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const scheduleDayConverge = useCallback(
    (profile: ProfileId, isoDate: string) => {
      const key = dayKey(profile, isoDate);
      const timers = convergeTimers.current;
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          void hydrateDayOnly(profile, isoDate).catch((err) =>
            console.warn("day converge failed", err),
          );
        }, DAY_CONVERGE_MS),
      );
    },
    [hydrateDayOnly],
  );
  useEffect(() => {
    const timers = convergeTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const hydrate = useCallback(
    async (profile: ProfileId, isoDate: string) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      try {
        await hydrateDayOnly(profile, isoDate);
        await hydrateWeighInsFor(profile);
        await hydratePrefsFor(profile);
      } catch (err) {
        console.warn("hydrate failed", err);
        publishState("error");
      }
    },
    [hydrateDayOnly, hydrateWeighInsFor, hydratePrefsFor, publishState],
  );

  // --- durable queue drain ---------------------------------------------------------
  const drain = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (draining.current) {
      drainAgain.current = true;
      return;
    }
    draining.current = true;
    const touchedDays = new Set<string>();
    try {
      if (queue.pending().length > 0) publishState("draining");
      const result = await drainQueue({
        pending: () => queue.pending().filter((m) => queue.ownedBy(m, userIdRef.current)),
        apply: async (m) => {
          const key = dayKeyOf(m.op);
          inFlightDay.current = key;
          try {
            await applyOperation(ctx, m.op);
            if (key) touchedDays.add(key);
          } finally {
            inFlightDay.current = null;
          }
        },
        remove: queue.remove,
        markFailure: queue.markFailure,
        quarantine: queue.quarantine,
        isOnline,
      });
      publishState(result.transientFailures > 0 ? "error" : "idle");
      if (result.transientFailures > 0) {
        console.warn("sync: transient failure — will retry", result);
      }
    } finally {
      draining.current = false;
    }
    // Converge the days we just wrote from the source of truth (cheap; also
    // covers the case where realtime is delayed or dropped). Coalesced with the
    // realtime echoes of the same writes.
    for (const key of touchedDays) {
      const [profile, isoDate] = key.split("::") as [ProfileId, string];
      scheduleDayConverge(profile, isoDate);
    }
    if (drainAgain.current) {
      drainAgain.current = false;
      void drain();
    }
  }, [scheduleDayConverge, publishState]);

  const scheduleDrain = useCallback(() => {
    if (drainTimer.current) clearTimeout(drainTimer.current);
    drainTimer.current = setTimeout(() => void drain(), DRAIN_DEBOUNCE_MS);
  }, [drain]);

  // --- activation: session -> bootstrap -> initial hydrate -> realtime -> drain ------
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let disposed = false;
    let unsubRealtime: (() => void) | null = null;
    // Single-flight: the auth SIGNED_IN event and the initial call can race;
    // without this both bootstrap and both subscribe (duplicate channels).
    let activating = false;
    // Session generation: a sign-out (or session replacement, DEC-031) that
    // lands while an activation is still awaiting the network must not let
    // that activation install a context/channel for a session that is gone.
    let generation = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;

    const setRealtime = (status: SyncDetail["realtime"]) => {
      realtimeRef.current = status;
      publishState();
    };

    // A transient failure at load (server unreachable, DNS hiccup) must not
    // leave the app permanently inactive: retry with bounded backoff until the
    // household context exists.
    function scheduleActivationRetry() {
      if (disposed || ctxRef.current || retryTimer) return;
      const delay = ACTIVATION_RETRY_MS[Math.min(retryAttempt, ACTIVATION_RETRY_MS.length - 1)];
      retryAttempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void activate();
      }, delay);
    }

    // A request that arrives mid-activation (e.g. the SIGNED_IN of a replacement
    // session, DEC-031) is remembered and served right after — never dropped.
    let activateAgain = false;
    async function activate() {
      if (activating) {
        activateAgain = true;
        return;
      }
      activating = true;
      try {
        await activateOnce();
      } finally {
        activating = false;
      }
      if (activateAgain && !disposed) {
        activateAgain = false;
        void activate();
      }
    }

    async function activateOnce() {
      const gen = generation;
      const session = await getSession();
      if (!session || disposed || ctxRef.current || gen !== generation) return;
      try {
        userIdRef.current = session.user.id;
        queue.setQueueOwner(session.user.id);
        // Every session on this device is a member of the one shared household
        // (DEC-031), so ops stamped by a previous device identity are adopted
        // and drained, never lost or parked as "another account".
        const adopted = queue.adoptAll(session.user.id);
        if (adopted > 0)
          console.info(
            `[elenas-plate] adopted ${adopted} queued op(s) from a previous device session`,
          );
        setSyncState("saving");
        const ctx = await bootstrapHousehold();
        if (disposed || gen !== generation) return; // session replaced meanwhile
        ctxRef.current = ctx;
        // Facts arrive with the bootstrap read — no second profiles query.
        const facts = ctx.profileFactsBySlug;
        if (facts?.ariel || facts?.alena) {
          setProfileFactsMap((prev) => ({
            me: facts.ariel ?? prev.me,
            elena: facts.alena ?? prev.elena,
          }));
        }

        // The one-time localStorage -> cloud import (T-023) is retired; markers
        // are still set so it can never fire again on an old profile.
        if (!isMigrated()) markMigrated();
        if (!isFoodsMigrated()) markFoodsMigrated();

        retryAttempt = 0;
        await hydrateFoodsList();
        await hydrateDerived();
        // Initial hydrate of the current view (own + partner day) BEFORE the
        // hook is flagged active, so the view effect below does not fetch the
        // same day a second time (it skips exactly this key once).
        const view = viewRef.current;
        await hydrate(view.profile, view.iso);
        await hydrateDayOnly(partnerOf(view.profile), view.iso).catch((err) =>
          console.warn("partner hydrate failed", err),
        );
        if (disposed || gen !== generation) return;
        hydratedAtActivation.current = dayKey(view.profile, view.iso);
        setActive(true);
        publishState();

        unsubRealtime = subscribeHousehold(ctx, onRealtime, session.access_token, setRealtime);
        // Anything left in the durable queue from a previous session goes first.
        void drain();
      } catch (err) {
        console.warn("supabase activation failed - will retry", err);
        ctxRef.current = null;
        setActive(false);
        publishState("error");
        scheduleActivationRetry();
      }
    }

    function onRealtime(change: RealtimeChange) {
      const view = viewRef.current;
      switch (change.table) {
        case "foods":
          void hydrateFoodsList();
          return;
        case "food_preferences":
          void hydratePrefsFor(change.profile ?? view.profile);
          return;
        case "weigh_ins":
          void hydrateWeighInsFor(change.profile ?? view.profile);
          return;
        case "profiles":
          void hydrateProfileFacts();
          return;
        case "dishes":
        case "dish_versions":
        case "estimated_products":
        case "weight_bridges":
          // Household-wide: a partner's new dish / product / bridge lands here.
          void hydrateDerived();
          return;
        default: {
          // Day-scoped tables. Use payload metadata when present; a DELETE
          // under default replica identity only carries the row id, so locate
          // the row in memory, else fall back to the current view.
          let profile = change.profile;
          let isoDate = change.iso;
          if ((!profile || !isoDate) && change.rowId) {
            const found = findEntryDay(daysRef.current, change.rowId);
            if (found) ({ profile, isoDate } = found);
          }
          if (!profile || !isoDate) ({ profile, iso: isoDate } = view);
          scheduleDayConverge(profile, isoDate);
        }
      }
    }

    void activate();
    const unsubAuth = onAuthChange((s) => {
      if (!s) {
        // Sign-out: drop the household context AND the realtime channel, so a
        // later sign-in subscribes exactly once instead of stacking channels.
        generation += 1;
        setActive(false);
        ctxRef.current = null;
        userIdRef.current = undefined;
        queue.setQueueOwner(undefined);
        unsubRealtime?.();
        unsubRealtime = null;
        setRealtime("off");
      } else {
        void activate();
      }
    });
    // Retry activation immediately when connectivity returns.
    const onOnline = () => {
      if (!ctxRef.current) {
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = null;
        void activate();
      }
    };
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      unsubAuth();
      unsubRealtime?.();
      window.removeEventListener("online", onOnline);
    };
  }, [
    drain,
    hydrate,
    hydrateDayOnly,
    hydrateFoodsList,
    hydrateDerived,
    hydratePrefsFor,
    hydrateProfileFacts,
    hydrateWeighInsFor,
    publishState,
    scheduleDayConverge,
    setSyncState,
    setProfileFactsMap,
  ]);

  // Hydrate when the viewed profile/date changes. The partner's day for the same
  // date is loaded too (M2 couple-first: the home screen shows both), guarded
  // like any hydrate against unsent local ops for that day.
  useEffect(() => {
    if (!active) return;
    // Activation already loaded exactly this view (own + partner day).
    if (hydratedAtActivation.current === dayKey(activeProfile, iso)) {
      hydratedAtActivation.current = null;
      return;
    }
    void hydrate(activeProfile, iso);
    void hydrateDayOnly(partnerOf(activeProfile), iso).catch((err) =>
      console.warn("partner hydrate failed", err),
    );
  }, [active, activeProfile, iso, hydrate, hydrateDayOnly]);

  // Drain when connectivity returns; a short interval is the reliable fallback
  // (some environments never fire "online") and no-ops when nothing is pending.
  useEffect(() => {
    if (!active) return;
    const onOnline = () => {
      publishState();
      scheduleDrain();
    };
    const onOffline = () => publishState();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const id = setInterval(() => {
      if (queue.pending().length > 0 && isOnline()) scheduleDrain();
    }, RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(id);
    };
  }, [active, scheduleDrain, publishState]);

  // Persist ops whenever Supabase is configured — even during the activation
  // window before `active` flips true — so a mutation made right after load is
  // durable immediately, protected from the initial hydrate, and drained once
  // the context is ready.
  const enqueue = useCallback(
    (ops: Operation[]) => {
      if (!isSupabaseConfigured()) return;
      for (const op of ops) queue.enqueueOperation(op);
      publishState();
      scheduleDrain();
    },
    [publishState, scheduleDrain],
  );

  const retryFailed = useCallback(() => {
    queue.retryQuarantined();
    publishState();
    scheduleDrain();
  }, [publishState, scheduleDrain]);

  const discardFailed = useCallback(() => {
    queue.discardQuarantined();
    publishState();
  }, [publishState]);

  return {
    active,
    enqueue,
    retryFailed,
    discardFailed,
    schema: { referenceGroupKey: schemaReferenceGroupKey, dishes: schemaDishes },
  };
}

/** Finds which in-memory day holds an entry id (for DELETE events without metadata). */
function findEntryDay(
  days: PerProfile<Record<string, DayData>>,
  entryId: string,
): { profile: ProfileId; isoDate: string } | null {
  for (const profile of ["me", "elena"] as ProfileId[]) {
    for (const [isoDate, day] of Object.entries(days[profile] ?? {})) {
      for (const meal of Object.values(day.meals)) {
        if (meal.entries.some((e) => e.id === entryId)) return { profile, isoDate };
      }
    }
  }
  return null;
}
