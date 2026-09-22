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

  it("a personal alias links a name to an EXISTING reference food and never creates a card (DEC-036)", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const before = result.current.foods.length;
    const target = result.current.foods.find((f) => f.name === "מלפפון")!;

    let a: Food | undefined;
    let b: Food | undefined;
    act(() => {
      a = result.current.addPersonalAlias("המלפפון שלי", target.referenceGroupKey!);
    });
    act(() => {
      b = result.current.addPersonalAlias("  המלפפון  שלי ", target.referenceGroupKey!);
    });
    // The alias returns the canonical food; the list did not grow; the name now finds it.
    expect(a!.id).toBe(target.id);
    expect(b!.id).toBe(target.id);
    expect(result.current.foods.length).toBe(before);
    expect(result.current.foods.find((f) => f.id === target.id)!.searchNames).toContain(
      "המלפפון שלי",
    );
    // A hidden legacy name cannot be revived by re-adding it as a "new food".
    expect(result.current.foods.some((f) => f.name === "קוטג׳")).toBe(false);
  });

  it("refuses a personal alias without an active reference target", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(() => result.current.addPersonalAlias("תבשיל של סבתא", "no such group")).toThrow();
    expect(result.current.foods.some((f) => f.name === "תבשיל של סבתא")).toBe(false);
  });

  it("adds a favorite only when the user asks for one", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current.favorites).toEqual([]);

    const cucumber = result.current.foods.find((f) => f.name === "מלפפון")!;
    act(() => result.current.toggleFavorite(cucumber.id));
    expect(result.current.favorites).toEqual([cucumber.id]);

    // Per profile: אלנה does not inherit אריאל's favorite.
    act(() => result.current.setActiveProfile("elena"));
    expect(result.current.favorites).toEqual([]);
  });

  it("records a recent only after a food is actually logged", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current.recents).toEqual([]);

    const cucumber = result.current.foods.find((f) => f.name === "מלפפון")!;
    act(() => {
      result.current.addEntry("lunch", {
        foodId: "f_cucumber", // a legacy id is mapped to the canonical food
        foodName: "מלפפון",
        mode: "measured",
        amount: 1,
        unit: "יחידה",
      });
    });

    expect(result.current.recents).toEqual([cucumber.id]);
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
});

describe("store — per-device default profile (M1 Phase B)", () => {
  beforeEach(() => window.localStorage.clear());

  it("asks who uses the device on first use and defaults to Ariel until answered", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current.deviceProfile).toBeNull();
    expect(result.current.deviceChooserOpen).toBe(true);
    expect(result.current.activeProfile).toBe("me");
  });

  it("choosing Elena persists on this device and survives a reload; switching still works", () => {
    const first = renderHook(() => useStore(), { wrapper });
    act(() => first.result.current.chooseDeviceProfile("elena"));
    expect(first.result.current.activeProfile).toBe("elena");
    expect(first.result.current.deviceChooserOpen).toBe(false);
    first.unmount();

    // Fresh provider = page reload: Elena is active by default, no chooser.
    const second = renderHook(() => useStore(), { wrapper });
    expect(second.result.current.deviceProfile).toBe("elena");
    expect(second.result.current.activeProfile).toBe("elena");
    expect(second.result.current.deviceChooserOpen).toBe(false);

    // Temporary switch to Ariel still works and does not change the device default.
    act(() => second.result.current.setActiveProfile("me"));
    expect(second.result.current.activeProfile).toBe("me");
    expect(second.result.current.deviceProfile).toBe("elena");
    second.unmount();
    const third = renderHook(() => useStore(), { wrapper });
    expect(third.result.current.activeProfile).toBe("elena");
  });

  it("the device preference wins over the demo snapshot last-active profile", () => {
    const first = renderHook(() => useStore(), { wrapper });
    act(() => first.result.current.chooseDeviceProfile("elena"));
    act(() => first.result.current.setActiveProfile("me"));
    act(() => first.result.current.addEntry("dinner", coffee)); // persists snapshot with "me"
    first.unmount();
    const second = renderHook(() => useStore(), { wrapper });
    expect(second.result.current.activeProfile).toBe("elena");
  });

  it("logs to the chosen profile, not Ariel, on a device set to Elena", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    act(() => result.current.chooseDeviceProfile("elena"));
    act(() => result.current.addEntry("lunch", coffee));
    expect(result.current.getDay("elena", today()).meals.lunch.entries).toHaveLength(1);
    expect(result.current.getDay("me", today()).meals.lunch.entries).toHaveLength(0);
  });

  it("the chooser can be re-opened and dismissed once a default exists", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    act(() => result.current.chooseDeviceProfile("me"));
    act(() => result.current.openDeviceChooser());
    expect(result.current.deviceChooserOpen).toBe(true);
    act(() => result.current.closeDeviceChooser());
    expect(result.current.deviceChooserOpen).toBe(false);
  });
});

describe("store — sync truth in demo mode", () => {
  beforeEach(() => window.localStorage.clear());

  it("exposes pending/failed counts (zero in demo mode) and retry controls", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current.syncDetail).toEqual({ pending: 0, failed: 0, realtime: "off" });
    expect(typeof result.current.retryFailedSync).toBe("function");
    expect(typeof result.current.discardFailedSync).toBe("function");
  });

  it("clearing fasting and workout removes them from the day", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    act(() => result.current.setFasting({ start: "20:00", end: "12:00" }));
    act(() => result.current.setWorkout({ performed: true, type: "ריצה" }));
    expect(result.current.getDay("me", today()).fasting).toEqual({ start: "20:00", end: "12:00" });
    act(() => result.current.setFasting(undefined));
    act(() => result.current.setWorkout(undefined));
    expect(result.current.getDay("me", today()).fasting).toBeUndefined();
    expect(result.current.getDay("me", today()).workout).toBeUndefined();
  });
});
