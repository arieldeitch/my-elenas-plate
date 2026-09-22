/**
 * DEC-036 acceptance — the points reference is the ONLY source of the active
 * food list and of every new points value. The 15 mandatory items of the run
 * (docs/claude-tasks/RUN_2026-09-22_REFERENCE_ONLY_FOODS.md), at the store /
 * resolver boundary, hermetic (demo store, no backend).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "../store";
import { toISODate } from "../format";
import { BUILT_IN_FOODS } from "../food-catalog";
import { pointsForEntry, scoreDetails } from "../points";
import { buildFoodSearchIndex, searchFoodsDetailed } from "../food-search";
import {
  aliasSafetyIssues,
  BUNDLED_ALIASES,
  canonicalIdFor,
  coffeeReferenceGroup,
  findGroupForName,
  getReferenceIndex,
  isSelectableItem,
  resolveCatalog,
  selectableItems,
} from "./index";
import aliasFile from "@/data/points-reference/aliases.v1.json";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);
const today = () => toISODate(new Date());
const index = getReferenceIndex();
const catalog = resolveCatalog(index, BUILT_IN_FOODS);
const byName = (name: string) => catalog.active.find((f) => f.name === name);

describe("canonical food resolution (DEC-036)", () => {
  beforeEach(() => window.localStorage.clear());

  it("1. legacy תפוח without its own reference row is not a card; 2. תפוח עץ is, with 100 גרם = 2", () => {
    expect(catalog.active.some((f) => f.name === "תפוח")).toBe(false);
    const apple = byName("תפוח עץ")!;
    expect(apple).toBeDefined();
    const rows = selectableItems(index.groupsByKey.get(apple.referenceGroupKey)!);
    expect(rows).toHaveLength(1);
    expect(rows[0].points).toBe(2);
    expect(rows[0].portion?.grams).toBe(100);
    expect(scoreDetails({ mode: "measured", amount: 100, unit: "גרם" }, apple)).toMatchObject({
      pointsValue: 2,
      pointsBasis: "reference:exact",
    });
  });

  it("3. the verified alias תפוח returns ONE result — the תפוח עץ card, no duplicate", () => {
    const hits = searchFoodsDetailed(buildFoodSearchIndex(catalog.active), "תפוח", 20);
    const appleHits = hits.filter((h) => h.food.name === "תפוח עץ");
    expect(appleHits).toHaveLength(1);
    expect(hits[0].food.name).toBe("תפוח עץ");
    expect(hits[0].matchedAlias).toBe("תפוח");
    expect(hits.some((h) => h.food.name === "תפוח")).toBe(false);
    // the legacy id maps onto the same canonical id
    expect(canonicalIdFor(catalog, "f_apple")).toBe(byName("תפוח עץ")!.canonicalId);
  });

  it("4. search never returns an unlinked legacy row (קוטג׳, ביסלי, מים are hidden)", () => {
    const idx = buildFoodSearchIndex(catalog.active);
    for (const name of ["קוטג", "ביסלי", "מים", "קרואסון"]) {
      const hits = searchFoodsDetailed(idx, name, 20);
      expect(
        hits.some((h) =>
          BUILT_IN_FOODS.some((b) => b.name === h.food.name && !h.food.referenceGroupKey),
        ),
      ).toBe(false);
    }
    expect(catalog.hidden.some((f) => f.name === "קוטג׳")).toBe(true);
    expect(catalog.hidden.some((f) => f.name === "מים")).toBe(true);
    for (const f of catalog.hidden) expect(canonicalIdFor(catalog, f.id)).toBeNull();
  });

  it("5. an old favourite of a hidden legacy food does not bypass the filter; a linked one maps to the canonical card", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    act(() => result.current.toggleFavorite("f_cottage")); // hidden legacy id
    act(() => result.current.toggleFavorite("f_apple")); // linked legacy id
    expect(result.current.favorites).toEqual([byName("תפוח עץ")!.id]);
  });

  it("6. recents of hidden legacy foods are filtered; linked ones are mapped and de-duplicated", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    act(() => {
      result.current.addEntry("lunch", {
        foodId: "f_cottage",
        foodName: "קוטג׳",
        mode: "measured",
        amount: 100,
        unit: "גרם",
      });
      result.current.addEntry("lunch", {
        foodId: "f_apple",
        foodName: "תפוח",
        mode: "measured",
        amount: 100,
        unit: "גרם",
      });
      result.current.addEntry("dinner", {
        foodId: byName("תפוח עץ")!.id,
        foodName: "תפוח עץ",
        mode: "measured",
        amount: 100,
        unit: "גרם",
      });
    });
    expect(result.current.recents).toEqual([byName("תפוח עץ")!.id]);
    // the hidden legacy entry was saved (history) but unscored, and keeps its own name
    const lunch = result.current.getDay("me", today()).meals.lunch.entries;
    expect(lunch[0]).toMatchObject({
      foodName: "קוטג׳",
      pointsValue: null,
      pointsBasis: "unscored:no_reference",
    });
    expect(lunch[1]).toMatchObject({ foodName: "תפוח עץ", pointsValue: 2 });
  });

  it("7. a custom food without a reference cannot be saved as a scored food", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(() => result.current.addPersonalAlias("קרקר של סבתא", "לא קיים")).toThrow();
    expect(result.current.foods.some((f) => f.name === "קרקר של סבתא")).toBe(false);
    expect(result.current.catalog.summary.linkedExplicit).toBe(0);
  });

  it("8. a personal alias linked to a reference food gets its points ONLY from that food", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const target = byName("אבוקדו")!;
    let linked!: ReturnType<typeof result.current.addPersonalAlias>;
    act(() => {
      linked = result.current.addPersonalAlias("האבוקדו של אריאל", target.referenceGroupKey);
    });
    expect(linked.id).toBe(target.id);
    expect(
      result.current.foods.filter((f) => f.referenceGroupKey === target.referenceGroupKey),
    ).toHaveLength(1);
    expect(result.current.catalog.summary.linkedExplicit).toBe(1);
    let e!: ReturnType<typeof result.current.addEntry>;
    act(() => {
      e = result.current.addEntry("lunch", {
        foodId: linked.id,
        foodName: "האבוקדו של אריאל",
        mode: "measured",
        amount: 60,
        unit: "גרם",
      });
    });
    expect(e).toMatchObject({
      foodName: "אבוקדו",
      pointsValue: 2,
      pointsBasis: "reference:scaled",
    });
    const idx = buildFoodSearchIndex(result.current.foods);
    expect(searchFoodsDetailed(idx, "האבוקדו של אריאל", 5)[0]).toMatchObject({
      food: { name: "אבוקדו" },
      matchedAlias: "האבוקדו של אריאל",
    });
  });

  it("9. תפוח אדמה: 200 גרם = 4 and 100 גרם = 2 (same-family scaling)", () => {
    const potato = byName("תפוח אדמה")!;
    expect(scoreDetails({ mode: "measured", amount: 200, unit: "גרם" }, potato).pointsValue).toBe(
      4,
    );
    expect(scoreDetails({ mode: "measured", amount: 100, unit: "גרם" }, potato).pointsValue).toBe(
      2,
    );
    expect(scoreDetails({ mode: "measured", amount: 100, unit: "גרם" }, potato).pointsBasis).toBe(
      "reference:scaled",
    );
  });

  it("10. incompatible units are blocked, not converted", () => {
    const potato = byName("תפוח אדמה")!;
    const cup = scoreDetails({ mode: "measured", amount: 1, unit: "כוס" }, potato);
    expect(cup).toMatchObject({ pointsValue: null, pointsBasis: "reference:blocked" });
    const unit = scoreDetails({ mode: "measured", amount: 1, unit: "יחידה" }, potato);
    expect(unit.pointsValue).toBeNull();
  });

  it("11. half points are kept, never rounded to a whole", () => {
    const cocoa = findGroupForName(index, "אבקת קקאו לא ממותקת")!;
    const spoon = selectableItems(cocoa).find((i) => i.points === 0.5)!;
    expect(
      scoreDetails({ mode: "measured", amount: 1, unit: "כף", referenceItemId: spoon.id })
        .pointsValue,
    ).toBe(0.5);
    expect(
      scoreDetails({ mode: "measured", amount: 3, unit: "כף", referenceItemId: spoon.id })
        .pointsValue,
    ).toBe(1.5);
    const yogurt = catalog.active.find((f) => f.name.startsWith("יוגורט טבעי 1.5%"));
    if (yogurt) {
      const rows = selectableItems(index.groupsByKey.get(yogurt.referenceGroupKey)!);
      expect(rows[0].points).toBe(2.5);
      expect(
        scoreDetails({ mode: "measured", amount: 150, unit: "גרם", referenceItemId: rows[0].id })
          .pointsValue,
      ).toBe(2.5);
    }
  });

  it("12. conflict and needs_review rows are never in the active list", () => {
    const names = new Set(catalog.active.map((f) => f.name));
    for (const item of index.itemsById.values()) {
      if (item.status === "conflict" || item.status === "needs_review") {
        const g = index.groupsByKey.get(item.normalizedName);
        // a name whose rows are ALL hidden is not a card
        if (!g || selectableItems(g).length === 0) expect(names.has(item.displayName)).toBe(false);
        expect(isSelectableItem(item)).toBe(false);
      }
    }
    expect(names.has("יוגורט טבעי 2.9% שומן -200ג, 2")).toBe(false);
    expect(names.has("משקה אורז 1% שומן")).toBe(false);
  });

  it("13. existing meal history is untouched: legacy snapshots keep name, quantity and value", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const legacy = {
      id: "legacy-1",
      foodId: "f_cottage",
      foodName: "קוטג׳",
      mode: "measured" as const,
      amount: 100,
      unit: "גרם" as const,
      pointsValue: 2,
      pointsModelVersion: "v2-il",
    };
    act(() => result.current.restoreEntry("breakfast", legacy));
    const stored = result.current.getDay("me", today()).meals.breakfast.entries[0];
    expect(stored).toEqual(legacy);
    expect(pointsForEntry(stored)).toBe(2); // the snapshot, although the food is hidden now
    expect(result.current.resolveFoodId(stored.foodId)).toBeNull();
  });

  it("14. re-adding (copying) a historical entry of an unlinked food fails clearly and safely: no legacy value", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const historical = {
      foodId: "f_cottage",
      foodName: "קוטג׳",
      mode: "measured" as const,
      amount: 100,
      unit: "גרם" as const,
    };
    // The resolver says "choose again"; a blind copy is saved unscored, never with an invented value.
    expect(result.current.resolveFoodId(historical.foodId)).toBeNull();
    let copy!: ReturnType<typeof result.current.addEntry>;
    act(() => {
      copy = result.current.addEntry("dinner", historical);
    });
    expect(copy.pointsValue).toBeNull();
    expect(copy.pointsBasis).toBe("unscored:no_reference");
    // A linked historical food copies through the reference.
    let ok!: ReturnType<typeof result.current.addEntry>;
    act(() => {
      ok = result.current.addEntry("dinner", {
        ...historical,
        foodId: "f_apple",
        foodName: "תפוח",
      });
    });
    expect(ok).toMatchObject({ foodName: "תפוח עץ", pointsValue: 2 });
  });

  it("15. no duplicates by canonical reference id in any active list", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const ids = result.current.foods.map((f) => f.canonicalId);
    expect(new Set(ids).size).toBe(ids.length);
    const names = result.current.foods.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    // every legacy food that resolves points at an existing card
    for (const [, c] of catalog.legacyToCanonical) {
      expect(result.current.foods.some((f) => f.canonicalId === c)).toBe(true);
    }
    expect(catalog.summary.duplicatesCollapsed).toBeGreaterThan(0);
  });
});

describe("verified aliases (aliases.v1.json)", () => {
  it("every alias targets exactly one selectable reference food, is unique, and passes the safety check or carries an override reason", () => {
    const seen = new Set<string>();
    for (const a of aliasFile.aliases as Array<{
      alias: string;
      target: string;
      safetyOverride?: string;
    }>) {
      const g = findGroupForName(index, a.target);
      expect(g, a.target).toBeDefined();
      expect(selectableItems(g!).length, a.target).toBeGreaterThan(0);
      expect(seen.has(a.alias), a.alias).toBe(false);
      seen.add(a.alias);
      const issues = aliasSafetyIssues(a.alias, a.target);
      if (issues.length > 0)
        expect(a.safetyOverride, `${a.alias} → ${a.target}: ${issues}`).toBeTruthy();
    }
    expect(BUNDLED_ALIASES.length).toBe(aliasFile.aliases.length);
    expect(index.aliasToGroup.size).toBe(aliasFile.aliases.length);
  });
});

describe("coffee scores through the reference (DEC-036)", () => {
  it("black → אספרסו 0; regular milk → קפוצינו 3%; low-fat → 1%; other milk → unscored", () => {
    expect(coffeeReferenceGroup(index, { milk: "ללא חלב" })?.name).toBe("אספרסו");
    expect(coffeeReferenceGroup(index, { milk: "עם חלב", milkType: "חלב רגיל" })?.name).toBe(
      "קפוצינו/הפוך 3% שומן",
    );
    expect(coffeeReferenceGroup(index, { milk: "עם חלב", milkType: "חלב דל שומן" })?.name).toBe(
      "קפוצינו/ הפוך 1% שומן",
    );
    expect(coffeeReferenceGroup(index, { milk: "עם חלב", milkType: "סויה" })).toBeNull();
    const black = scoreDetails({
      mode: "measured",
      amount: 2,
      unit: "כוס",
      coffee: { type: "אמריקנו", milk: "ללא חלב" },
    });
    expect(black).toMatchObject({ pointsValue: 0, pointsBasis: "reference:any" });
    const capp = scoreDetails({
      mode: "measured",
      amount: 1,
      unit: "כוס",
      coffee: { type: "קפוצ׳ינו", milk: "עם חלב", milkType: "חלב רגיל" },
    });
    expect(capp).toMatchObject({ pointsValue: 3, pointsBasis: "reference:exact" });
    const soy = scoreDetails({
      mode: "measured",
      amount: 1,
      unit: "כוס",
      coffee: { type: "לאטה", milk: "עם חלב", milkType: "סויה" },
    });
    expect(soy).toMatchObject({ pointsValue: null, pointsBasis: "unscored:no_reference" });
  });
});
