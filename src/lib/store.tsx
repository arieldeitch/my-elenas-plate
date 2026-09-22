/**
 * Application store.
 *
 * Wraps all app state in a single React context; every mutation flows through
 * this repository-like API, which is what lets Supabase be the source of truth
 * without UI components knowing about it (`useSupabaseSync` below hydrates and
 * pushes through the same setters).
 *
 * M1 (shared-truth recovery): every interactive edit applies optimistically to
 * local state AND emits narrow operations (`sync/operations.ts`) that describe
 * exactly the rows it touched. In cloud mode those ops are persisted in the
 * durable queue and drained to Supabase one by one; nothing here ever pushes a
 * whole-day snapshot, so a stale device cannot erase its partner's entries.
 *
 * All tracking data starts empty in every mode — there is no demo or mock seed
 * anywhere in the app. Content comes from Supabase when configured, or from
 * localStorage in local demo mode.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  DayData,
  DailyMeal,
  FastingLog,
  Food,
  FoodEntry,
  MealSlotId,
  Profile,
  ProfileId,
  StepLog,
  SyncState,
  WeighIn,
  WorkoutLog,
} from "./domain";
import { MEAL_SLOTS } from "./domain";
import { FOOD_CATALOG, mergeCatalog } from "./food-catalog";
import { normalizeFoodName } from "./food-normalize";
import {
  canonicalIdFor,
  getReferenceIndex,
  resolveCatalog,
  type CanonicalFood,
  type ResolvedCatalog,
} from "./points-reference";
import {
  latestWeightKg,
  resolvePointsBudget,
  scoreEntry,
  type BudgetInfo,
  type ProfileFacts,
} from "./points";
import { toISODate } from "./format";
import { loadState, saveState } from "./persistence";
import { loadDeviceProfile, saveDeviceProfile } from "./device-profile";
import { isSupabaseConfigured } from "./supabase/client";
import { INITIAL_SYNC_DETAIL, useSupabaseSync, type SyncDetail } from "./sync/use-supabase-sync";
import {
  opsForAddEntry,
  opsForRemoveEntry,
  opsForSetFasting,
  opsForSetMealSkipped,
  opsForSetSteps,
  opsForSetWorkout,
  opsForUpdateEntry,
} from "./sync/operations";

export const PROFILES: Profile[] = [
  { id: "me", name: "אריאל", initials: "א", color: "#117d52", tint: "#EDF8F2" },
  { id: "elena", name: "אלנה", initials: "א", color: "#1F6FBD", tint: "#EDF6FD" },
];

type PerProfile<T> = Record<ProfileId, T>;

interface StoreValue {
  activeProfile: ProfileId;
  setActiveProfile: (p: ProfileId) => void;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;

  /** This device's stored default profile (null until chosen). Never nutrition data. */
  deviceProfile: ProfileId | null;
  deviceChooserOpen: boolean;
  chooseDeviceProfile: (p: ProfileId) => void;
  openDeviceChooser: () => void;
  closeDeviceChooser: () => void;

  syncState: SyncState;
  syncDetail: SyncDetail;
  retryFailedSync: () => void;
  discardFailedSync: () => void;

  getDay: (profile: ProfileId, iso: string) => DayData;
  getAllDays: (profile: ProfileId) => Record<string, DayData>;

  /**
   * The ONE active list (DEC-036): canonical reference foods only (+ the coffee
   * editor). Legacy catalog rows appear only through a verified link, as the
   * reference food; unlinked ones are hidden (history only).
   */
  foods: CanonicalFood[];
  /** The full resolution (hidden legacy foods, legacy→canonical map, summary). */
  catalog: ResolvedCatalog;
  /** The canonical id an arbitrary stored food id maps to, or null when that food is hidden. */
  resolveFoodId: (foodId: string) => string | null;
  /**
   * Saves a personal alias: a name of the person's own for an EXISTING
   * reference food (DEC-036). The alias never becomes a card or a value of its
   * own — it makes the reference food findable by that name. Returns the
   * canonical food. A name that already resolves is reused, nothing is created.
   */
  addPersonalAlias: (name: string, referenceGroupKey: string) => CanonicalFood;
  /** True once the cloud schema can store personal aliases (migration 20260922 applied). */
  personalAliasesSupported: boolean;
  favorites: string[];
  recents: string[];
  toggleFavorite: (foodId: string) => void;

  addEntry: (slot: MealSlotId, entry: Omit<FoodEntry, "id">) => FoodEntry;
  updateEntry: (slot: MealSlotId, entry: FoodEntry) => void;
  removeEntry: (slot: MealSlotId, entryId: string) => FoodEntry | undefined;
  restoreEntry: (slot: MealSlotId, entry: FoodEntry) => void;
  setMealSkipped: (slot: MealSlotId, skipped: boolean) => void;

  setFasting: (f: FastingLog | undefined) => void;
  setWorkout: (w: WorkoutLog | undefined) => void;
  setSteps: (s: StepLog) => void;

  /** Effective daily budget (override → personalised → fallback). */
  getPointsBudget: (profile: ProfileId) => number;
  /** Budget plus where it comes from and which facts are still missing. */
  getPointsBudgetInfo: (profile: ProfileId) => BudgetInfo;
  /** The active person's stored facts (DEC-034). */
  profileFacts: ProfileFacts;
  /** Partial update of the active person's facts; `pointsBudgetOverride: null` = back to automatic. */
  setProfileFacts: (patch: Partial<ProfileFacts>) => void;
  /** @deprecated v1 name — sets the manual override. */
  setPointsBudget: (budget: number) => void;

  weighIns: WeighIn[];
  addWeighIn: (w: Omit<WeighIn, "id">) => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

function emptyDay(goalSteps = 10_000): DayData {
  const meals = {} as Record<MealSlotId, DailyMeal>;
  for (const s of MEAL_SLOTS) meals[s] = { slot: s, status: "empty", entries: [] };
  return { meals, steps: { goalSteps, completed: false } };
}

function latestStepGoal(profileDays: Record<string, DayData>): number {
  const candidates = Object.entries(profileDays)
    .filter(([, day]) => day.steps?.goalSteps && day.steps.goalSteps > 0)
    .sort(([a], [b]) => (a < b ? 1 : -1));
  return candidates[0]?.[1].steps?.goalSteps ?? 10_000;
}

let localId = 100_000;
// UUIDs so a locally-created id is also a valid Supabase primary key (the
// optimistic id survives the round-trip). Falls back to a counter if the
// runtime lacks crypto.randomUUID.
const genId = (p = "x") =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${p}_${++localId}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  // Per-device default profile (M1 Phase B). SSR has no window, so the initial
  // render is always "me" with the chooser closed; the mount effect below applies
  // this device's stored preference (or opens the chooser) before anything can
  // be logged. Keeping the initial state SSR-identical avoids hydration errors.
  const [deviceProfile, setDeviceProfile] = useState<ProfileId | null>(null);
  const [activeProfile, setActiveProfile] = useState<ProfileId>("me");
  const [deviceChooserOpen, setDeviceChooserOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [syncState, setSyncState] = useState<SyncState>("saved");
  const [syncDetail, setSyncDetail] = useState<SyncDetail>(INITIAL_SYNC_DETAIL);

  // Tracking data always starts EMPTY, in every mode. There is no demo/mock seed
  // anywhere in the app: a seed once leaked into a real cloud account (see
  // project-status, T-028 bug 2), and favorites / recents / history must only
  // ever reflect real logging. Content comes from Supabase, or from localStorage
  // in local demo mode.
  const [days, setDays] = useState<PerProfile<Record<string, DayData>>>({ me: {}, elena: {} });
  const [weighInsMap, setWeighInsMap] = useState<PerProfile<WeighIn[]>>({ me: [], elena: [] });
  const [favoritesMap, setFavoritesMap] = useState<PerProfile<string[]>>({ me: [], elena: [] });
  const [recentsMap, setRecentsMap] = useState<PerProfile<string[]>>({ me: [], elena: [] });
  const [profileFactsMap, setProfileFactsMap] = useState<PerProfile<ProfileFacts>>({
    me: {},
    elena: {},
  });
  // The built-in catalog is the pre-hydration fallback; Supabase supersedes it
  // by normalized name once loaded (see `mergeCatalog`).
  const [foods, setFoods] = useState<Food[]>(FOOD_CATALOG);
  // DEC-036: the active list is built from the reference alone; the household
  // foods (built-in + custom rows) are resolved against it — explicit link,
  // verified alias or exact name — and everything else is hidden. Derived,
  // never persisted.
  const catalog = useMemo(() => resolveCatalog(getReferenceIndex(), foods), [foods]);
  const resolveFoodId = useCallback((foodId: string) => canonicalIdFor(catalog, foodId), [catalog]);
  // Favourites / recents are stored by food id (legacy or canonical). They are
  // shown only when they resolve to an ACTIVE food, mapped to its canonical id
  // and de-duplicated — a hidden legacy favourite never bypasses the filter.
  const visibleIds = useCallback(
    (ids: string[]) => {
      const out: string[] = [];
      for (const id of ids) {
        const c = canonicalIdFor(catalog, id);
        if (c && !out.includes(c)) out.push(c);
      }
      return out;
    },
    [catalog],
  );

  const iso = toISODate(selectedDate);

  // Supabase sync — the source of truth when configured + authenticated.
  // Inert (returns active=false) in local demo mode, so nothing below changes.
  const sync = useSupabaseSync({
    days,
    setDays,
    weighInsMap,
    setWeighInsMap,
    foods,
    setFoods,
    setFavoritesMap,
    setRecentsMap,
    setProfileFactsMap,
    activeProfile,
    iso,
    setSyncState,
    setSyncDetail,
  });

  // Interim demo persistence (localStorage) — used ONLY when Supabase is not the
  // source of truth. Hydrate once on the client, then persist changes.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Only demo mode reads localStorage. When Supabase is configured it is the
    // source of truth, and restoring a legacy local snapshot here would
    // resurrect data the cloud no longer has (including any pre-cleanup rows).
    if (isSupabaseConfigured()) {
      setHydrated(true);
      return;
    }
    const saved = loadState();
    if (saved) {
      setDays(saved.days);
      setWeighInsMap(saved.weighIns);
      setFavoritesMap(saved.favorites);
      setRecentsMap(saved.recents);
      // Merge rather than replace: a snapshot taken before a catalog update must
      // not shrink the catalog back to its older contents.
      setFoods(mergeCatalog(FOOD_CATALOG, saved.foods));
      // The device preference always wins over the snapshot's last-active profile.
      if (loadDeviceProfile() === null) setActiveProfile(saved.activeProfile);
    }
    setHydrated(true);
  }, []);

  // Apply the device preference after the demo snapshot (declaration order):
  // the stored device profile always wins; a device that never chose is asked.
  useEffect(() => {
    const stored = loadDeviceProfile();
    if (stored) {
      setDeviceProfile(stored);
      setActiveProfile(stored);
    } else {
      setDeviceChooserOpen(true);
    }
  }, []);

  useEffect(() => {
    // When Supabase is configured it is the source of truth — never persist to
    // localStorage (otherwise the demo seed would be saved and then migrated
    // into a brand-new cloud account). Demo mode persists as before.
    if (!hydrated || isSupabaseConfigured()) return;
    saveState({
      activeProfile,
      days,
      weighIns: weighInsMap,
      favorites: favoritesMap,
      recents: recentsMap,
      foods,
    });
  }, [hydrated, activeProfile, days, weighInsMap, favoritesMap, recentsMap, foods]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Never let the demo "saved" pulse fire on an unmounted provider.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  // Demo-mode-only "saving → saved" pulse for localStorage writes. In cloud
  // mode the sync state is derived exclusively from the durable queue (see
  // useSupabaseSync) so the UI can never claim "saved" while ops are pending.
  const triggerSave = useCallback(() => {
    if (isSupabaseConfigured()) return;
    setSyncState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSyncState("saved"), 650);
  }, []);

  const chooseDeviceProfile = useCallback((p: ProfileId) => {
    saveDeviceProfile(p);
    setDeviceProfile(p);
    setActiveProfile(p);
    setDeviceChooserOpen(false);
  }, []);
  const openDeviceChooser = useCallback(() => setDeviceChooserOpen(true), []);
  const closeDeviceChooser = useCallback(() => setDeviceChooserOpen(false), []);

  const getDay = useCallback(
    (profile: ProfileId, isoDate: string): DayData => {
      return days[profile][isoDate] ?? emptyDay(latestStepGoal(days[profile]));
    },
    [days],
  );

  const getAllDays = useCallback((profile: ProfileId) => days[profile], [days]);

  const mutateDay = useCallback(
    (profile: ProfileId, isoDate: string, updater: (d: DayData) => DayData) => {
      setDays((prev) => {
        const existing = prev[profile][isoDate] ?? emptyDay(latestStepGoal(prev[profile]));
        const next = updater(structuredClone(existing));
        return { ...prev, [profile]: { ...prev[profile], [isoDate]: next } };
      });
      triggerSave();
    },
    [triggerSave],
  );

  const pushRecent = useCallback(
    (foodId: string) => {
      setRecentsMap((prev) => {
        const list = prev[activeProfile].filter((id) => id !== foodId);
        list.unshift(foodId);
        return { ...prev, [activeProfile]: list.slice(0, 12) };
      });
      sync.enqueue([
        { kind: "pref.recent", profile: activeProfile, foodId, at: new Date().toISOString() },
      ]);
    },
    [activeProfile, sync],
  );

  const dayCtx = { profile: activeProfile, iso };

  /** Every entry of the active person's selected day (benefit eligibility). */
  const dayEntriesNow = () => {
    const current = days[activeProfile][iso];
    return current ? Object.values(current.meals).flatMap((m) => m.entries) : [];
  };

  const addEntry: StoreValue["addEntry"] = (slot, entry) => {
    // A new entry always references the canonical food (a legacy id is mapped).
    const foodId = canonicalIdFor(catalog, entry.foodId) ?? entry.foodId;
    const food = catalog.active.find((f) => f.id === foodId);
    const base: FoodEntry = {
      ...entry,
      foodId,
      foodName: food?.name ?? entry.foodName,
      id: genId("e"),
      loggedAt: new Date().toISOString(),
    };
    // Every NEW entry carries a snapshot from the reference (or is saved
    // unscored — never estimated); it is never rewritten later.
    const withId: FoodEntry = scoreEntry(base, food, { dayEntries: dayEntriesNow() });
    mutateDay(activeProfile, iso, (d) => {
      const meal = d.meals[slot];
      meal.entries.push(withId);
      meal.status = "logged";
      return d;
    });
    sync.enqueue(opsForAddEntry(dayCtx, slot, withId));
    pushRecent(withId.foodId);
    return withId;
  };

  const updateEntry: StoreValue["updateEntry"] = (slot, entry) => {
    const canonical = canonicalIdFor(catalog, entry.foodId);
    const food = canonical ? catalog.active.find((f) => f.id === canonical) : undefined;
    // A deliberate edit re-scores — this is the only path by which a legacy
    // snapshot changes (DEC-034 §S). Editing a food in the reference or the
    // catalog never touches an existing entry.
    const scored: FoodEntry = scoreEntry(entry, food, { dayEntries: dayEntriesNow() });
    mutateDay(activeProfile, iso, (d) => {
      const meal = d.meals[slot];
      meal.entries = meal.entries.map((e) => (e.id === scored.id ? scored : e));
      return d;
    });
    sync.enqueue(opsForUpdateEntry(dayCtx, slot, scored));
  };

  const removeEntry: StoreValue["removeEntry"] = (slot, entryId) => {
    // Read the entry from current state *before* mutating: the setDays updater
    // runs after this function returns, so capturing it inside would yield
    // undefined and break the undo toast.
    const current = days[activeProfile][iso] ?? emptyDay(latestStepGoal(days[activeProfile]));
    const meal = current.meals[slot];
    const removed = meal.entries.find((e) => e.id === entryId);
    const remaining = meal.entries.filter((e) => e.id !== entryId).length;
    mutateDay(activeProfile, iso, (d) => {
      const m = d.meals[slot];
      m.entries = m.entries.filter((e) => e.id !== entryId);
      if (m.entries.length === 0 && m.status === "logged") {
        m.status = "empty";
      }
      return d;
    });
    sync.enqueue(opsForRemoveEntry(dayCtx, slot, entryId, remaining, meal.status));
    return removed;
  };

  const restoreEntry: StoreValue["restoreEntry"] = (slot, entry) => {
    mutateDay(activeProfile, iso, (d) => {
      const meal = d.meals[slot];
      meal.entries.push(entry);
      meal.status = "logged";
      return d;
    });
    sync.enqueue(opsForAddEntry(dayCtx, slot, entry));
  };

  const setMealSkipped: StoreValue["setMealSkipped"] = (slot, skipped) => {
    const current = days[activeProfile][iso] ?? emptyDay(latestStepGoal(days[activeProfile]));
    const visibleIds = current.meals[slot].entries.map((e) => e.id);
    mutateDay(activeProfile, iso, (d) => {
      const meal = d.meals[slot];
      if (skipped) {
        meal.status = "skipped";
        meal.entries = [];
      } else {
        meal.status = meal.entries.length > 0 ? "logged" : "empty";
      }
      return d;
    });
    sync.enqueue(opsForSetMealSkipped(dayCtx, slot, skipped, visibleIds));
  };

  const setFasting: StoreValue["setFasting"] = (f) => {
    mutateDay(activeProfile, iso, (d) => {
      d.fasting = f;
      return d;
    });
    sync.enqueue(opsForSetFasting(dayCtx, f));
  };

  const setWorkout: StoreValue["setWorkout"] = (w) => {
    mutateDay(activeProfile, iso, (d) => {
      d.workout = w;
      return d;
    });
    sync.enqueue(opsForSetWorkout(dayCtx, w));
  };

  const setSteps: StoreValue["setSteps"] = (s) => {
    const normalized: StepLog = {
      goalSteps: Math.max(1, Math.round(s.goalSteps)),
      steps: s.steps == null ? undefined : Math.max(0, Math.round(s.steps)),
      completed: s.steps == null ? s.completed : s.steps >= s.goalSteps,
    };
    mutateDay(activeProfile, iso, (d) => {
      d.steps = normalized;
      return d;
    });
    sync.enqueue(opsForSetSteps(dayCtx, normalized));
  };

  // Budget = f(facts, latest weigh-in of THAT profile). Pure and cheap; the
  // partner's facts/weight never enter the other person's number.
  const getPointsBudgetInfo = useCallback(
    (profile: ProfileId): BudgetInfo =>
      resolvePointsBudget(profileFactsMap[profile], latestWeightKg(weighInsMap[profile] ?? [])),
    [profileFactsMap, weighInsMap],
  );
  const getPointsBudget = useCallback(
    (profile: ProfileId) => getPointsBudgetInfo(profile).budget,
    [getPointsBudgetInfo],
  );

  const setProfileFacts: StoreValue["setProfileFacts"] = (patch) => {
    const merged = { ...profileFactsMap[activeProfile], ...patch };
    setProfileFactsMap((prev) => ({ ...prev, [activeProfile]: merged }));
    // The queue coalesces per profile, so the op carries the WHOLE merged facts:
    // the last write always contains every field, never a partial that would
    // drop an earlier unsent change.
    sync.enqueue([{ kind: "profile.facts.set", profile: activeProfile, facts: merged }]);
  };

  const setPointsBudget: StoreValue["setPointsBudget"] = (budget) => {
    setProfileFacts({ pointsBudgetOverride: Math.max(10, Math.min(60, Math.round(budget))) });
  };

  // Personal aliases need the cloud column `foods.reference_group_key` (migration
  // 20260922090000). Until a hydrated row shows the column exists, creating one
  // is refused with an explanation instead of failing silently in the queue.
  const personalAliasesSupported = !isSupabaseConfigured() || sync.schema.referenceGroupKey;

  const addPersonalAlias: StoreValue["addPersonalAlias"] = (name, referenceGroupKey) => {
    const trimmed = name.trim();
    const target = catalog.active.find((f) => f.referenceGroupKey === referenceGroupKey);
    if (!target) throw new Error("personal alias must point at an active reference food");
    // A name that already resolves (reference name, verified alias, existing
    // personal alias) needs nothing new: the DB is unique per normalized name.
    const key = normalizeFoodName(trimmed);
    const existing = foods.find((f) => normalizeFoodName(f.name) === key);
    if (existing) {
      const c = canonicalIdFor(catalog, existing.id);
      if (c) return catalog.active.find((f) => f.id === c)!;
    }
    if (!existing) {
      const f: Food = {
        id: genId("f"),
        name: trimmed,
        category: target.category,
        defaultUnit: target.defaultUnit,
        referenceGroupKey,
        createdBy: activeProfile,
      };
      setFoods((prev) => [f, ...prev]);
      sync.enqueue([{ kind: "food.upsert", food: f }]);
    }
    return target;
  };

  const toggleFavorite: StoreValue["toggleFavorite"] = (foodId) => {
    const isNowFavorite = !favoritesMap[activeProfile].includes(foodId);
    setFavoritesMap((prev) => {
      const list = prev[activeProfile];
      const next = isNowFavorite ? [foodId, ...list] : list.filter((x) => x !== foodId);
      return { ...prev, [activeProfile]: next };
    });
    triggerSave();
    sync.enqueue([
      { kind: "pref.favorite", profile: activeProfile, foodId, isFavorite: isNowFavorite },
    ]);
  };

  const addWeighIn: StoreValue["addWeighIn"] = (w) => {
    const wi: WeighIn = { ...w, id: genId("w") };
    setWeighInsMap((prev) => ({
      ...prev,
      [activeProfile]: [...prev[activeProfile], wi].sort((a, b) =>
        a.dateISO < b.dateISO ? -1 : 1,
      ),
    }));
    triggerSave();
    sync.enqueue([{ kind: "weighin.insert", profile: activeProfile, weighIn: wi }]);
  };

  const value = useMemo<StoreValue>(
    () => ({
      activeProfile,
      setActiveProfile,
      selectedDate,
      setSelectedDate,
      deviceProfile,
      deviceChooserOpen,
      chooseDeviceProfile,
      openDeviceChooser,
      closeDeviceChooser,
      syncState,
      syncDetail,
      retryFailedSync: sync.retryFailed,
      discardFailedSync: sync.discardFailed,
      getDay,
      getAllDays,
      foods: catalog.active,
      catalog,
      resolveFoodId,
      addPersonalAlias,
      personalAliasesSupported,
      favorites: visibleIds(favoritesMap[activeProfile]),
      recents: visibleIds(recentsMap[activeProfile]),
      toggleFavorite,
      addEntry,
      updateEntry,
      removeEntry,
      restoreEntry,
      setMealSkipped,
      setFasting,
      setWorkout,
      setSteps,
      getPointsBudget,
      getPointsBudgetInfo,
      profileFacts: profileFactsMap[activeProfile],
      setProfileFacts,
      setPointsBudget,
      weighIns: weighInsMap[activeProfile],
      addWeighIn,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeProfile,
      selectedDate,
      deviceProfile,
      deviceChooserOpen,
      syncState,
      syncDetail,
      days,
      weighInsMap,
      favoritesMap,
      recentsMap,
      profileFactsMap,
      catalog,
    ],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
