import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "./store";
import { toISODate } from "./format";
import { MEAL_SLOTS } from "./domain";
import type { Food, FoodEntry } from "./domain";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);
const today = () => toISODate(new Date());

const coffee: Omit<FoodEntry, "id"> = {
  foodId: "f_coffee",
  foodName: "קפה",
  mode: "measured",
  amount: 1,
  unit: "כוס",
  coffee: { type: "אמריקנו", milk: "עם חלב", milkType: "שקדים" },
};

describe("store", () => {
  // Persistence uses localStorage; clear it so each test starts empty.
  beforeEach(() => window.localStorage.clear());

  it("keeps data separate per profile and preserves the date on switch", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const date = result.current.selectedDate;

    act(() => {
      result.current.addEntry("dinner", {
        foodId: "f_apple",
        foodName: "תפוח",
        mode: "measured",
        amount: 1,
        unit: "יחידה",
      });
    });

    // Present for the active profile (Ariel / "me").
    expect(result.current.getDay("me", today()).meals.dinner.entries).toHaveLength(1);

    act(() => result.current.setActiveProfile("elena"));

    // Date is unchanged by the profile switch.
    expect(result.current.selectedDate).toBe(date);
    // Elena's dinner does not contain Ariel's entry.
    const elenaDinner = result.current.getDay("elena", today()).meals.dinner.entries;
    expect(elenaDinner.find((e) => e.foodId === "f_apple")).toBeUndefined();
  });

  it("clears skipped status when a food is added afterwards", () => {
    const { result } = renderHook(() => useStore(), { wrapper });

    act(() => result.current.setMealSkipped("late", true));
    expect(result.current.getDay("me", today()).meals.late.status).toBe("skipped");

    act(() => {
      result.current.setMealSkipped("late", false);
      result.current.addEntry("late", coffee);
    });

    const meal = result.current.getDay("me", today()).meals.late;
    expect(meal.status).toBe("logged");
    expect(meal.entries).toHaveLength(1);
  });

  it("persists structured coffee metadata on the entry", () => {
    const { result } = renderHook(() => useStore(), { wrapper });

    // The store starts empty, so the only coffee here is ours.
    act(() => result.current.addEntry("dinner", coffee));

    const entries = result.current.getDay("me", today()).meals.dinner.entries;
    const added = entries.find((e) => e.coffee);
    expect(added?.coffee).toEqual({ type: "אמריקנו", milk: "עם חלב", milkType: "שקדים" });
  });

  it("restores persisted data on a fresh mount (survives refresh)", () => {
    const first = renderHook(() => useStore(), { wrapper });
    act(() => first.result.current.addEntry("dinner", coffee));
    first.unmount();

    // A brand-new provider simulates a page refresh; data comes from storage.
    const second = renderHook(() => useStore(), { wrapper });
    const entries = second.result.current.getDay("me", today()).meals.dinner.entries;
    expect(entries.find((e) => e.coffee)?.coffee?.type).toBe("אמריקנו");
  });

  it("starts with no tracking data, favorites or recents for either profile", () => {
    const { result } = renderHook(() => useStore(), { wrapper });

    for (const profile of ["me", "elena"] as const) {
      expect(result.current.getAllDays(profile)).toEqual({});
      for (const slot of MEAL_SLOTS) {
        const meal = result.current.getDay(profile, today()).meals[slot];
        expect(meal.status).toBe("empty");
        expect(meal.entries).toEqual([]);
      }
    }
    expect(result.current.favorites).toEqual([]);
    expect(result.current.recents).toEqual([]);
    expect(result.current.weighIns).toEqual([]);
  });

  it("exposes the full catalog without any pre-created preference", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current.foods.length).toBeGreaterThanOrEqual(300);
    expect(result.current.favorites).toHaveLength(0);
    expect(result.current.recents).toHaveLength(0);
  });

  it("reuses an existing food instead of creating a normalized duplicate", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const before = result.current.foods.length;

    // Same food, three ways a person might type it.
    let a: Food | undefined;
    let b: Food | undefined;
    act(() => {
      a = result.current.addFood("קוטג'");
    });
    act(() => {
      b = result.current.addFood("  קוטג׳  ");
    });

    expect(a!.name).toBe("קוטג׳");
    expect(b!.id).toBe(a!.id);
    expect(result.current.foods.length).toBe(before);
  });

  it("still creates a genuinely new custom food", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const before = result.current.foods.length;

    let created: Food | undefined;
    act(() => {
      created = result.current.addFood("תבשיל של סבתא");
    });

    expect(created!.name).toBe("תבשיל של סבתא");
    expect(created!.id.startsWith("f_")).toBe(false); // custom id, syncs to Supabase
    expect(result.current.foods.length).toBe(before + 1);

    // ...and a second attempt at the same name does not duplicate it.
    act(() => {
      result.current.addFood("תבשיל  של   סבתא");
    });
    expect(result.current.foods.length).toBe(before + 1);
  });

  it("adds a favorite only when the user asks for one", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current.favorites).toEqual([]);

    act(() => result.current.toggleFavorite("f_cucumber"));
    expect(result.current.favorites).toEqual(["f_cucumber"]);

    // Per profile: אלנה does not inherit אריאל's favorite.
    act(() => result.current.setActiveProfile("elena"));
    expect(result.current.favorites).toEqual([]);
  });

  it("records a recent only after a food is actually logged", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current.recents).toEqual([]);

    act(() => {
      result.current.addEntry("lunch", {
        foodId: "f_cucumber",
        foodName: "מלפפון",
        mode: "measured",
        amount: 1,
        unit: "יחידה",
      });
    });

    expect(result.current.recents).toEqual(["f_cucumber"]);
    act(() => result.current.setActiveProfile("elena"));
    expect(result.current.recents).toEqual([]);
  });

  it("restores a removed entry (undo)", () => {
    const { result } = renderHook(() => useStore(), { wrapper });

    let removed: FoodEntry | undefined;
    act(() => {
      result.current.addEntry("lunch", coffee);
    });
    const entry = result.current.getDay("me", today()).meals.lunch.entries.at(-1)!;

    act(() => {
      removed = result.current.removeEntry("lunch", entry.id);
    });
    expect(removed?.foodId).toBe("f_coffee");

    act(() => result.current.restoreEntry("lunch", removed!));
    expect(
      result.current.getDay("me", today()).meals.lunch.entries.find((e) => e.id === entry.id),
    ).toBeTruthy();
  });

  it("uses a 10,000 step fallback and keeps step goals isolated per profile", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current.stepGoal).toBe(10_000);
    act(() => result.current.setStepGoal(8_500));
    expect(result.current.stepGoal).toBe(8_500);
    act(() => result.current.setActiveProfile("elena"));
    expect(result.current.stepGoal).toBe(10_000);
  });

  it("stores exact and completed-only step reports on the selected profile and date", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const yesterday = new Date(2026, 8, 18);
    act(() => result.current.setSelectedDate(yesterday));
    act(() => result.current.setSteps({ steps: 8_734, completed: false, goal: 10_000 }));
    expect(result.current.getDay("me", "2026-09-18").steps).toEqual({ steps: 8_734, completed: false, goal: 10_000 });

    act(() => result.current.setActiveProfile("elena"));
    act(() => result.current.setSteps({ completed: true, goal: 10_000 }));
    expect(result.current.getDay("elena", "2026-09-18").steps).toEqual({ completed: true, goal: 10_000 });
    expect(result.current.getDay("me", "2026-09-18").steps?.steps).toBe(8_734);
  });
});
