/**
 * DEC-035 acceptance items 9–12 at the store boundary (hermetic, demo store):
 *   9.  a food with no reference match is never scored silently;
 *   10. a confirmed custom food is saved and reused with its value;
 *   11. a historical snapshot does not change when the food's value changes;
 *   12. separation and ownership between Ariel and Elena.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "../store";
import { toISODate } from "../format";
import { pointsForEntry } from "../points";
import { findGroupForName, getReferenceIndex } from "./index";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);
const today = () => toISODate(new Date());

describe("store × points reference", () => {
  beforeEach(() => window.localStorage.clear());

  it("9. an unknown food created without a confirmed value is 'unscored' and never scored silently", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    let food!: ReturnType<typeof result.current.addFood>;
    act(() => {
      food = result.current.addFood("קרקר של סבתא");
    });
    expect(food.pointsStatus).toBe("unscored");
    expect(food.referenceGroupKey).toBeUndefined();
    expect(findGroupForName(getReferenceIndex(), "קרקר של סבתא")).toBeUndefined();
    let entry!: ReturnType<typeof result.current.addEntry>;
    act(() => {
      entry = result.current.addEntry("dinner", {
        foodId: food.id,
        foodName: food.name,
        mode: "measured",
        amount: 2,
        unit: "יחידה",
      });
    });
    // Without a reference or a confirmed value the internal model is the basis —
    // and the basis is recorded, so the UI can say so instead of pretending.
    expect(entry.pointsBasis).toBe("model:v2-il");
    expect(entry.referenceItemId).toBeUndefined();
  });

  it("10. a confirmed custom food is saved with its portion value and reused on the next add", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    let food!: ReturnType<typeof result.current.addFood>;
    act(() => {
      food = result.current.addFood("קרקר של סבתא", "דגנים ופחמימות", {
        portionAmount: 1,
        portionUnit: "יחידה",
        pointsPerPortion: 1.5,
        pointsStatus: "confirmed",
      });
    });
    expect(food).toMatchObject({
      pointsStatus: "confirmed",
      pointsPerPortion: 1.5,
      portionAmount: 1,
      portionUnit: "יחידה",
      createdBy: "me",
      category: "דגנים ופחמימות",
    });
    let e1!: ReturnType<typeof result.current.addEntry>;
    act(() => {
      e1 = result.current.addEntry("dinner", {
        foodId: food.id,
        foodName: food.name,
        mode: "measured",
        amount: 3,
        unit: "יחידה",
      });
    });
    expect(e1.pointsValue).toBe(4.5);
    expect(e1.pointsBasis).toBe("custom:confirmed");
    // Reuse: the same name resolves to the SAME food (no twin), same value.
    let again!: ReturnType<typeof result.current.addFood>;
    act(() => {
      again = result.current.addFood("קרקר של סבתא");
    });
    expect(again.id).toBe(food.id);
    expect(again.pointsPerPortion).toBe(1.5);
    expect(result.current.foods.filter((f) => f.name === "קרקר של סבתא")).toHaveLength(1);
    // Grams for a per-unit value are refused, not invented.
    let blocked!: ReturnType<typeof result.current.addEntry>;
    act(() => {
      blocked = result.current.addEntry("dinner", {
        foodId: food.id,
        foodName: food.name,
        mode: "measured",
        amount: 50,
        unit: "גרם",
      });
    });
    expect(blocked.pointsBasis).toBe("custom:blocked");
    expect(blocked.pointsValue).toBe(0);
  });

  it("11. editing the food's value later does not change the snapshot already logged", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const index = getReferenceIndex();
    const avocado = result.current.foods.find((f) => f.name === "אבוקדו")!;
    expect(avocado.referenceGroupKey).toBeDefined();
    const item = index.groupsByKey.get(avocado.referenceGroupKey!)!.items[0];
    let e!: ReturnType<typeof result.current.addEntry>;
    act(() => {
      e = result.current.addEntry("lunch", {
        foodId: avocado.id,
        foodName: avocado.name,
        mode: "measured",
        amount: 60,
        unit: "גרם",
      });
    });
    expect(e).toMatchObject({
      pointsValue: 2,
      basePoints: 2,
      pointsBasis: "reference:scaled",
      referenceItemId: item.id,
      foodName: "אבוקדו",
      amount: 60,
      unit: "גרם",
    });
    // A later change to the reference row (new version / correction) …
    const original = item.points;
    item.points = 9;
    try {
      const stored = result.current.getDay("me", today()).meals.lunch.entries[0];
      expect(pointsForEntry(stored, avocado)).toBe(2); // snapshot wins
      expect(stored.pointsValue).toBe(2);
      expect(stored.referenceItemId).toBe(item.id);
      // … affects only a NEW entry.
      let fresh!: ReturnType<typeof result.current.addEntry>;
      act(() => {
        fresh = result.current.addEntry("lunch", {
          foodId: avocado.id,
          foodName: avocado.name,
          mode: "measured",
          amount: 60,
          unit: "גרם",
        });
      });
      expect(fresh.pointsValue).toBe(18);
      expect(result.current.getDay("me", today()).meals.lunch.entries[0].pointsValue).toBe(2);
    } finally {
      item.points = original;
    }
    // The snapshot also carries the name/quantity/unit as logged: renaming the
    // food does not rewrite what was eaten.
    const stored = result.current.getDay("me", today()).meals.lunch.entries[0];
    expect([stored.foodName, stored.amount, stored.unit]).toEqual(["אבוקדו", 60, "גרם"]);
  });

  it("12. Ariel's entries and custom foods stay Ariel's; the canonical reference is shared", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    let mine!: ReturnType<typeof result.current.addFood>;
    act(() => {
      mine = result.current.addFood("גרנולה של אריאל", "דגנים ופחמימות", {
        portionAmount: 30,
        portionUnit: "גרם",
        pointsPerPortion: 3,
        pointsStatus: "confirmed",
      });
      result.current.addEntry("breakfast", {
        foodId: mine.id,
        foodName: mine.name,
        mode: "measured",
        amount: 30,
        unit: "גרם",
      });
    });
    expect(mine.createdBy).toBe("me");
    expect(result.current.getDay("me", today()).meals.breakfast.entries).toHaveLength(1);
    act(() => result.current.setActiveProfile("elena"));
    // Elena's day is untouched; the household catalog (incl. Ariel's food, with
    // its owner) and the reference are visible to her.
    expect(result.current.getDay("elena", today()).meals.breakfast.entries).toHaveLength(0);
    expect(result.current.foods.find((f) => f.id === mine.id)?.createdBy).toBe("me");
    expect(result.current.foods.some((f) => f.name === "אבוקדו" && f.referenceGroupKey)).toBe(true);
    let hers!: ReturnType<typeof result.current.addFood>;
    act(() => {
      hers = result.current.addFood("סלט של אלנה", "סלטים מוכנים", {
        portionAmount: 1,
        portionUnit: "מנה",
        pointsPerPortion: 2,
        pointsStatus: "confirmed",
      });
    });
    expect(hers.createdBy).toBe("elena");
    expect(result.current.getDay("me", today()).meals.breakfast.entries).toHaveLength(1);
  });

  it("reference-only foods are searchable and score from their row; conflict rows are absent", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const brazil = result.current.foods.find((f) => f.name === "אגוז ברזיל")!;
    expect(brazil.id.startsWith("r_")).toBe(true);
    expect(result.current.foods.some((f) => f.name === "יוגורט טבעי 2.9% שומן -200ג, 2")).toBe(
      false,
    );
    const group = getReferenceIndex().groupsByKey.get(brazil.referenceGroupKey!)!;
    let e!: ReturnType<typeof result.current.addEntry>;
    act(() => {
      e = result.current.addEntry("morning_snack", {
        foodId: brazil.id,
        foodName: brazil.name,
        mode: "measured",
        amount: 4,
        unit: "יחידה",
        referenceItemId: group.items[0].id,
      });
    });
    expect(e.pointsValue).toBe(2);
    expect(e.pointsBasis).toBe("reference:scaled");
    // The linked built-in fruit scores through the reference now (בננה 100 גרם = 2).
    const banana = result.current.foods.find((f) => f.name === "בננה")!;
    expect(banana.id).toBe("f_banana");
    let b!: ReturnType<typeof result.current.addEntry>;
    act(() => {
      b = result.current.addEntry("morning_snack", {
        foodId: banana.id,
        foodName: banana.name,
        mode: "measured",
        amount: 50,
        unit: "גרם",
      });
    });
    expect(b.pointsBasis).toBe("reference:scaled");
    expect(b.pointsValue).toBe(1);
  });
});
