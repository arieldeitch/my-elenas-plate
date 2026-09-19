/**
 * Application store.
 *
 * Wraps all app state in a single React context; every mutation flows through
 * this repository-like API, which is what lets Supabase be the source of truth
 * without UI components knowing about it (`useSupabaseSync` below hydrates and
 * pushes through the same setters).
 *
 * All tracking state starts empty in every mode — there is no demo or mock seed
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
  DailySteps,
  DailyMeal,
  FastingLog,
  Food,
  FoodEntry,
  MealSlotId,
  Profile,
  ProfileId,
  SyncState,
  WeighIn,
  WorkoutLog,
} from "./domain";
import { MEAL_SLOTS } from "./domain";
import { FOOD_CATALOG, mergeCatalog } from "./food-catalog";
import { normalizeFoodName } from "./food-normalize";
import { toISODate } from "./format";
import { loadState, saveState } from "./persistence";
import { isSupabaseConfigured } from "./supabase/client";
import { useSupabaseSync } from "./sync/use-supabase-sync";

export const PROFILES: Profile[] = [
  { id: "me", name: "אריאל", initials: "א" },
  { id: "elena", name: "אלנה", initials: "א" },
];

type PerProfile<T> = Record<ProfileId, T>;

interface StoreValue {
  activeProfile: ProfileId;
  setActiveProfile: (p: ProfileId) => void;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;

  syncState: SyncState;

  getDay: (profile: ProfileId, iso: string) => DayData;
  getAllDays: (profile: ProfileId) => Record<string, DayData>;

  foods: Food[];
  addFood: (name: string, category?: string) => Food;
  favorites: string[];
  recents: string[];
  toggleFavorite: (foodId: string) => void;

  addEntry: (slot: MealSlotId, entry: Omit<FoodEntry, "id">) => void;
  updateEntry: (slot: MealSlotId, entry: FoodEntry) => void;
  removeEntry: (slot: MealSlotId, entryId: string) => FoodEntry | undefined;
  restoreEntry: (slot: MealSlotId, entry: FoodEntry) => void;
  setMealSkipped: (slot: MealSlotId, skipped: boolean) => void;

  setFasting: (f: FastingLog | undefined) => void;
  setWorkout: (w: WorkoutLog | undefined) => void;
  steps?: DailySteps;
  stepGoal: number;
  setSteps: (steps: DailySteps) => void;
  setStepGoal: (goal: number) => void;

  weighIns: WeighIn[];
  addWeighIn: (w: Omit<WeighIn, "id">) => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

function emptyDay(): DayData {
  const meals = {} as Record<MealSlotId, DailyMeal>;
  for (const s of MEAL_SLOTS) meals[s] = { slot: s, status: "empty", entries: [] };
  return { meals };
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
  const [activeProfile, setActiveProfile] = useState<ProfileId>("me");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [syncState, setSyncState] = useState<SyncState>("saved");

  // Tracking data always starts EMPTY, in every mode. There is no demo/mock seed
  // anywhere in the app: a seed once leaked into a real cloud account (see
  // project-status, T-028 bug 2), and favorites / recents / history must only
  // ever reflect real logging. Content comes from Supabase, or from localStorage
  // in local demo mode.
  const [days, setDays] = useState<PerProfile<Record<string, DayData>>>({ me: {}, elena: {} });
  const [weighInsMap, setWeighInsMap] = useState<PerProfile<WeighIn[]>>({ me: [], elena: [] });
  const [favoritesMap, setFavoritesMap] = useState<PerProfile<string[]>>({ me: [], elena: [] });
  const [recentsMap, setRecentsMap] = useState<PerProfile<string[]>>({ me: [], elena: [] });
  const [stepGoals, setStepGoals] = useState<PerProfile<number>>({ me: 10_000, elena: 10_000 });
  // The built-in catalog is the pre-hydration fallback; Supabase supersedes it
  // by normalized name once loaded (see `mergeCatalog`).
  const [foods, setFoods] = useState<Food[]>(FOOD_CATALOG);

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
    stepGoals,
    setStepGoals,
    activeProfile,
    iso,
    setSyncState,
  });

  // Interim demo persistence (localStorage) — used ONLY when Supabase is not the
  // source of truth. Hydrate once on the client, then persist changes.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Only demo mode reads localStorage. When Supabase is configured it is the
    // source of truth, and restoring a legacy local snapshot here would
    // resurrect data the cloud no longer has (including any pre-cleanup rows).
    // The one-time local->cloud import reads storage separately, in the sync layer.
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
      setActiveProfile(saved.activeProfile);
      if (saved.stepGoals) setStepGoals(saved.stepGoals);
    }
    setHydrated(true);
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
      stepGoals,
    });
  }, [hydrated, activeProfile, days, weighInsMap, favoritesMap, recentsMap, foods, stepGoals]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(() => {
    setSyncState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSyncState("saved"), 650);
  }, []);

  const getDay = useCallback(
    (profile: ProfileId, isoDate: string): DayData => {
      return days[profile][isoDate] ?? emptyDay();
    },
    [days],
  );

  const getAllDays = useCallback((profile: ProfileId) => days[profile], [days]);

  const mutateDay = useCallback(
    (profile: ProfileId, isoDate: string, updater: (d: DayData) => DayData) => {
      setDays((prev) => {
        const existing = prev[profile][isoDate] ?? emptyDay();
        const next = updater(structuredClone(existing));
        return { ...prev, [profile]: { ...prev[profile], [isoDate]: next } };
      });
      triggerSave();
      sync.markDayDirty(profile, isoDate);
    },
    [triggerSave, sync],
  );

  const pushRecent = useCallback(
    (foodId: string) => {
      setRecentsMap((prev) => {
        const list = prev[activeProfile].filter((id) => id !== foodId);
        list.unshift(foodId);
        return { ...prev, [activeProfile]: list.slice(0, 12) };
      });
      sync.markRecentDirty(activeProfile, foodId, new Date().toISOString());
    },
    [activeProfile, sync],
  );

  const addEntry: StoreValue["addEntry"] = (slot, entry) => {
    const withId: FoodEntry = { ...entry, id: genId("e") };
    mutateDay(activeProfile, iso, (d) => {
      const meal = d.meals[slot];
      meal.entries.push(withId);
      meal.status = "logged";
      return d;
    });
    pushRecent(withId.foodId);
  };

  const updateEntry: StoreValue["updateEntry"] = (slot, entry) => {
    mutateDay(activeProfile, iso, (d) => {
      const meal = d.meals[slot];
      meal.entries = meal.entries.map((e) => (e.id === entry.id ? entry : e));
      return d;
    });
  };

  const removeEntry: StoreValue["removeEntry"] = (slot, entryId) => {
    // Read the entry from current state *before* mutating: the setDays updater
    // runs after this function returns, so capturing it inside would yield
    // undefined and break the undo toast.
    const current = days[activeProfile][iso] ?? emptyDay();
    const removed = current.meals[slot].entries.find((e) => e.id === entryId);
    mutateDay(activeProfile, iso, (d) => {
      const meal = d.meals[slot];
      meal.entries = meal.entries.filter((e) => e.id !== entryId);
      if (meal.entries.length === 0 && meal.status === "logged") {
        meal.status = "empty";
      }
      return d;
    });
    return removed;
  };

  const restoreEntry: StoreValue["restoreEntry"] = (slot, entry) => {
    mutateDay(activeProfile, iso, (d) => {
      const meal = d.meals[slot];
      meal.entries.push(entry);
      meal.status = "logged";
      return d;
    });
  };

  const setMealSkipped: StoreValue["setMealSkipped"] = (slot, skipped) => {
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
  };

  const setFasting: StoreValue["setFasting"] = (f) => {
    mutateDay(activeProfile, iso, (d) => {
      d.fasting = f;
      return d;
    });
  };

  const setWorkout: StoreValue["setWorkout"] = (w) => {
    mutateDay(activeProfile, iso, (d) => {
      d.workout = w;
      return d;
    });
  };

  const setSteps: StoreValue["setSteps"] = (report) => {
    mutateDay(activeProfile, iso, (d) => {
      d.steps = report;
      return d;
    });
    sync.markStepsDirty(activeProfile, iso, report);
  };

  const setStepGoal: StoreValue["setStepGoal"] = (goal) => {
    if (!Number.isInteger(goal) || goal <= 0) return;
    setStepGoals((prev) => ({ ...prev, [activeProfile]: goal }));
    triggerSave();
    sync.markStepGoalDirty(activeProfile, goal);
  };

  const addFood: StoreValue["addFood"] = (name, category) => {
    const trimmed = name.trim();
    // Duplicate prevention: the DB enforces unique (household_id, normalized_name),
    // so creating a food that normalizes onto an existing one would fail to sync
    // and split favorites/recents across two ids. Reuse the existing food instead —
    // this is what makes "קוטג" resolve to קוטג׳ rather than creating a twin.
    const key = normalizeFoodName(trimmed);
    const existing = foods.find((f) => normalizeFoodName(f.name) === key);
    if (existing) return existing;

    const f: Food = {
      id: genId("f"),
      name: trimmed,
      category,
      defaultUnit: "יחידה",
      suggestedUnits: ["יחידה", "גרם", "מנה"],
    };
    setFoods((prev) => [f, ...prev]);
    sync.markFoodDirty(f);
    return f;
  };

  const toggleFavorite: StoreValue["toggleFavorite"] = (foodId) => {
    const isNowFavorite = !favoritesMap[activeProfile].includes(foodId);
    setFavoritesMap((prev) => {
      const list = prev[activeProfile];
      const next = isNowFavorite ? [foodId, ...list] : list.filter((x) => x !== foodId);
      return { ...prev, [activeProfile]: next };
    });
    triggerSave();
    sync.markFavoriteDirty(activeProfile, foodId, isNowFavorite);
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
    sync.markWeighDirty(activeProfile);
  };

  const value = useMemo<StoreValue>(
    () => ({
      activeProfile,
      setActiveProfile,
      selectedDate,
      setSelectedDate,
      syncState,
      getDay,
      getAllDays,
      foods,
      addFood,
      favorites: favoritesMap[activeProfile],
      recents: recentsMap[activeProfile],
      toggleFavorite,
      addEntry,
      updateEntry,
      removeEntry,
      restoreEntry,
      setMealSkipped,
      setFasting,
      setWorkout,
      steps: getDay(activeProfile, iso).steps,
      stepGoal: stepGoals[activeProfile],
      setSteps,
      setStepGoal,
      weighIns: weighInsMap[activeProfile],
      addWeighIn,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProfile, selectedDate, syncState, days, weighInsMap, favoritesMap, recentsMap, foods, stepGoals],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
