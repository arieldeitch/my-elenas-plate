import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "./store";
import { toISODate } from "./format";
import type { FoodEntry } from "./domain";

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
  // Persistence uses localStorage; clear it so each test starts from the seed.
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

    // `dinner` starts empty in the demo seed, so the only coffee here is ours.
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
});
