/**
 * Demo store for the pilot.
 *
 * Wraps all app state in a single React context. All mutations flow through
 * this repository-like API so the future Supabase integration can replace the
 * in-memory implementation without touching UI components.
 *
 * TODO(supabase): replace the internal useState maps with a Supabase-backed
 * repository (household -> profiles -> days -> meals -> entries). RLS should
 * scope reads/writes to the current profile's household.
 */
import {
  createContext,
  useCallback,
  useContext,
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
  SyncState,
  WeighIn,
  WorkoutLog,
} from "./domain";
import { MEAL_SLOTS } from "./domain";
import { FOOD_CATALOG } from "./food-catalog";
import {
  initialDays,
  initialFavorites,
  initialRecents,
  initialWeighIns,
} from "./demo-data";
import { toISODate } from "./format";

export const PROFILES: Profile[] = [
  { id: "me", name: "אני", initials: "א" },
  { id: "elena", name: "אלנה", initials: "ל" },
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
const genId = (p = "x") => `${p}_${++localId}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [activeProfile, setActiveProfile] = useState<ProfileId>("me");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [syncState, setSyncState] = useState<SyncState>("saved");

  const [days, setDays] = useState<PerProfile<Record<string, DayData>>>(() => ({
    me: initialDays("me"),
    elena: initialDays("elena"),
  }));
  const [weighInsMap, setWeighInsMap] = useState<PerProfile<WeighIn[]>>(() => ({
    me: initialWeighIns("me"),
    elena: initialWeighIns("elena"),
  }));
  const [favoritesMap, setFavoritesMap] = useState<PerProfile<string[]>>(() => ({
    me: initialFavorites("me"),
    elena: initialFavorites("elena"),
  }));
  const [recentsMap, setRecentsMap] = useState<PerProfile<string[]>>(() => ({
    me: initialRecents("me"),
    elena: initialRecents("elena"),
  }));
  const [foods, setFoods] = useState<Food[]>(FOOD_CATALOG);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(() => {
    setSyncState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSyncState("saved"), 650);
  }, []);

  const iso = toISODate(selectedDate);

  const getDay = useCallback(
    (profile: ProfileId, isoDate: string): DayData => {
      return days[profile][isoDate] ?? emptyDay();
    },
    [days],
  );

  const getAllDays = useCallback(
    (profile: ProfileId) => days[profile],
    [days],
  );

  const mutateDay = useCallback(
    (profile: ProfileId, isoDate: string, updater: (d: DayData) => DayData) => {
      setDays((prev) => {
        const existing = prev[profile][isoDate] ?? emptyDay();
        const next = updater(structuredClone(existing));
        return { ...prev, [profile]: { ...prev[profile], [isoDate]: next } };
      });
      triggerSave();
    },
    [triggerSave],
  );

  const pushRecent = useCallback((foodId: string) => {
    setRecentsMap((prev) => {
      const list = prev[activeProfile].filter((id) => id !== foodId);
      list.unshift(foodId);
      return { ...prev, [activeProfile]: list.slice(0, 12) };
    });
  }, [activeProfile]);

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
    let removed: FoodEntry | undefined;
    mutateDay(activeProfile, iso, (d) => {
      const meal = d.meals[slot];
      removed = meal.entries.find((e) => e.id === entryId);
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

  const addFood: StoreValue["addFood"] = (name, category) => {
    const f: Food = {
      id: genId("f"),
      name: name.trim(),
      category,
      defaultUnit: "יחידה",
      suggestedUnits: ["יחידה", "גרם", "מנה"],
    };
    setFoods((prev) => [f, ...prev]);
    return f;
  };

  const toggleFavorite: StoreValue["toggleFavorite"] = (foodId) => {
    setFavoritesMap((prev) => {
      const list = prev[activeProfile];
      const next = list.includes(foodId) ? list.filter((x) => x !== foodId) : [foodId, ...list];
      return { ...prev, [activeProfile]: next };
    });
    triggerSave();
  };

  const addWeighIn: StoreValue["addWeighIn"] = (w) => {
    const wi: WeighIn = { ...w, id: genId("w") };
    setWeighInsMap((prev) => ({
      ...prev,
      [activeProfile]: [...prev[activeProfile], wi].sort(
        (a, b) => (a.dateISO < b.dateISO ? -1 : 1),
      ),
    }));
    triggerSave();
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
      weighIns: weighInsMap[activeProfile],
      addWeighIn,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProfile, selectedDate, syncState, days, weighInsMap, favoritesMap, recentsMap, foods],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
