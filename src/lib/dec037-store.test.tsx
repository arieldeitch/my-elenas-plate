/**
 * DEC-037 at the store boundary (hermetic demo store, no backend): creating
 * dishes and estimated products, logging servings, and the non-negotiable
 * history invariants (acceptance 4–6, 11–13, 17–19).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { DuplicateDishNameError, StoreProvider, useStore } from "./store";
import { toISODate } from "./format";
import { pointsForEntry } from "./points";
import { LABEL_ESTIMATOR_VERSION } from "./label-estimator";
import { buildBridgeIndex } from "./weight-bridges";
import { resolveIngredient } from "./dishes";
import { findGroupForName, getReferenceIndex, selectableItems } from "./points-reference";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);
const today = () => toISODate(new Date());
const index = getReferenceIndex();

/** A canonical gram-based ingredient the dish editor would produce. */
function gramIngredient(name: string, grams: number) {
  const group = findGroupForName(index, name)!;
  const item = selectableItems(group)[0];
  const r = resolveIngredient(
    {
      sourceKind: "reference",
      item,
      name: group.name,
      groupKey: group.key,
      amount: grams,
      unit: "גרם",
    },
    buildBridgeIndex([]),
  );
  if (!r.ok) throw new Error(`could not resolve ${name}: ${r.reason}`);
  return r.ingredient;
}

describe("dishes in the store", () => {
  beforeEach(() => window.localStorage.clear());

  it("6. creates a dish from three canonical gram-based ingredients with a deterministic rate", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    const ingredients = [
      gramIngredient("אבוקדו", 100), // 30 g = 1 → 100 g = 3.5 (rounded by the engine)
      gramIngredient("תפוח אדמה", 200), // 200 g = 4
      gramIngredient("תפוח עץ", 100), // 100 g = 2
    ];
    let dish!: ReturnType<typeof result.current.saveDish>;
    act(() => {
      dish = result.current.saveDish({
        name: "תבשיל בדיקה",
        ingredients,
        finalWeightG: 400,
        usualServingWeightG: 200,
      });
    });
    const expectedTotal = ingredients.reduce((s, i) => s + i.points, 0);
    expect(dish.totalPoints).toBe(expectedTotal);
    expect(dish.pointsPerGram).toBe(expectedTotal / 400);
    expect(dish.revision).toBe(1);
    expect(dish.createdBy).toBe("me");
    expect(dish.hasEstimatedIngredient).toBe(false);
    expect(result.current.dishes).toHaveLength(1);
    // 19. the canonical reference itself is untouched by creating a dish.
    expect(getReferenceIndex().itemsById.size).toBe(index.itemsById.size);
  });

  it("15/16. logs a weighed and an estimated serving, each with its own provenance", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    let dishId = "";
    act(() => {
      dishId = result.current.saveDish({
        name: "תבשיל",
        ingredients: [gramIngredient("תפוח אדמה", 200)], // 4 points
        finalWeightG: 400,
      }).id;
    });
    act(() => {
      result.current.logDish("lunch", { dishId, grams: 250, weightSource: "weighed" });
      result.current.logDish("dinner", { dishId, grams: 250, weightSource: "estimated" });
    });
    const day = result.current.getDay("me", today());
    const weighed = day.meals.lunch.entries[0];
    const estimated = day.meals.dinner.entries[0];
    expect(weighed).toMatchObject({
      foodName: "תבשיל",
      pointsBasis: "dish:weighed",
      consumedWeightG: 250,
      dishRevision: 1,
      unit: "גרם",
      amount: 250,
    });
    expect(estimated).toMatchObject({ pointsBasis: "dish:estimated", weightSource: "estimated" });
    expect(weighed.pointsValue).toBe(2.5); // 4/400 × 250
    expect(weighed.pointsValue).toBe(estimated.pointsValue);
    expect(weighed.dishId).toBe(dishId);
  });

  it("17. editing a dish creates a new revision and never changes a logged serving", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    let dishId = "";
    act(() => {
      dishId = result.current.saveDish({
        name: "תבשיל",
        ingredients: [gramIngredient("תפוח אדמה", 200)],
        finalWeightG: 400,
      }).id;
    });
    act(() => {
      result.current.logDish("lunch", { dishId, grams: 250, weightSource: "weighed" });
    });
    const before = { ...result.current.getDay("me", today()).meals.lunch.entries[0] };
    expect(before.pointsValue).toBe(2.5);

    // The dish becomes much denser.
    act(() => {
      result.current.saveDish({
        id: dishId,
        name: "תבשיל",
        ingredients: [gramIngredient("תפוח אדמה", 200), gramIngredient("אבוקדו", 100)],
        finalWeightG: 400,
      });
    });
    const dish = result.current.dishes.find((d) => d.id === dishId)!;
    expect(dish.revision).toBe(2);
    expect(dish.pointsPerGram).toBeGreaterThan(4 / 400);

    const after = result.current.getDay("me", today()).meals.lunch.entries[0];
    expect(after).toEqual(before); // the whole snapshot, not just the value
    expect(pointsForEntry(after)).toBe(2.5);
    expect(after.dishRevision).toBe(1);

    // A NEW serving uses the new revision.
    act(() => {
      result.current.logDish("dinner", { dishId, grams: 250, weightSource: "weighed" });
    });
    const fresh = result.current.getDay("me", today()).meals.dinner.entries[0];
    expect(fresh.dishRevision).toBe(2);
    expect(fresh.pointsValue).toBeGreaterThan(2.5);
  });

  it("archives and restores a dish without touching history", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    let dishId = "";
    act(() => {
      dishId = result.current.saveDish({
        name: "תבשיל",
        ingredients: [gramIngredient("תפוח אדמה", 200)],
        finalWeightG: 400,
      }).id;
    });
    // A separate commit, as in the UI: the dish list re-renders before logging.
    act(() => {
      result.current.logDish("lunch", { dishId, grams: 100, weightSource: "weighed" });
    });
    const logged = { ...result.current.getDay("me", today()).meals.lunch.entries[0] };
    act(() => result.current.setDishActive(dishId, false));
    expect(result.current.dishes).toHaveLength(0);
    expect(result.current.allDishes).toHaveLength(1);
    expect(result.current.getDay("me", today()).meals.lunch.entries[0]).toEqual(logged);
    act(() => result.current.setDishActive(dishId, true));
    expect(result.current.dishes).toHaveLength(1);
  });
});

describe("estimated products in the store", () => {
  beforeEach(() => window.localStorage.clear());

  it("9/11/12. saves a label-estimated product, logs it, and keeps the estimate provenance", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    let product!: ReturnType<typeof result.current.saveEstimatedProduct>;
    act(() => {
      product = result.current.saveEstimatedProduct({
        name: "קרקר מהסופר",
        label: { basis: "per_100g", calories: 400, proteinG: 8, fiberG: 3 },
      });
    });
    expect(product.estimatorVersion).toBe(LABEL_ESTIMATOR_VERSION);
    expect(product.pointsPer100g).toBeGreaterThan(0);
    expect(product.createdBy).toBe("me");
    expect(product.label.calories).toBe(400); // the exact input is persisted
    // 11. the partner sees and can reuse it (household-wide state).
    act(() => result.current.setActiveProfile("elena"));
    expect(result.current.estimatedProducts.find((p) => p.id === product.id)).toBeDefined();

    let entry!: ReturnType<typeof result.current.addEntry>;
    act(() => {
      entry = result.current.addEntry("lunch", {
        foodId: product.id,
        foodName: product.name,
        mode: "measured",
        amount: 50,
        unit: "גרם",
        estimatedProductId: product.id,
        consumedWeightG: 50,
      });
    });
    expect(entry.pointsBasis).toBe("estimated:label");
    expect(entry.estimatedProductId).toBe(product.id);
    expect(entry.pointsValue).toBeGreaterThan(0);
  });

  it("18. editing an estimated product does not rewrite earlier meals or dishes", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    let productId = "";
    act(() => {
      productId = result.current.saveEstimatedProduct({
        name: "חטיף",
        label: { basis: "per_100g", calories: 400 },
      }).id;
    });
    const product = result.current.estimatedProducts[0];
    // a dish that uses it, and a direct meal entry
    const dishIngredient = resolveIngredient(
      { sourceKind: "estimated", product, amount: 100, unit: "גרם" },
      buildBridgeIndex([]),
    );
    expect(dishIngredient.ok).toBe(true);
    if (!dishIngredient.ok) return;
    let dishId = "";
    act(() => {
      dishId = result.current.saveDish({
        name: "תבשיל עם חטיף",
        ingredients: [dishIngredient.ingredient],
        finalWeightG: 200,
      }).id;
      result.current.addEntry("lunch", {
        foodId: productId,
        foodName: "חטיף",
        mode: "measured",
        amount: 100,
        unit: "גרם",
        estimatedProductId: productId,
        consumedWeightG: 100,
      });
    });
    const dishBefore = { ...result.current.dishes.find((d) => d.id === dishId)! };
    const entryBefore = { ...result.current.getDay("me", today()).meals.lunch.entries[0] };

    // The label is corrected upward.
    act(() => {
      result.current.saveEstimatedProduct({
        id: productId,
        name: "חטיף",
        label: { basis: "per_100g", calories: 900 },
      });
    });
    const updated = result.current.estimatedProducts.find((p) => p.id === productId)!;
    expect(updated.pointsPer100g).toBeGreaterThan(product.pointsPer100g);

    // Neither the saved dish definition nor the logged entry moved.
    const dishAfter = result.current.dishes.find((d) => d.id === dishId)!;
    expect(dishAfter.totalPoints).toBe(dishBefore.totalPoints);
    expect(dishAfter.ingredients[0].points).toBe(dishBefore.ingredients[0].points);
    expect(result.current.getDay("me", today()).meals.lunch.entries[0]).toEqual(entryBefore);
  });
});

describe("weight bridges in the store", () => {
  beforeEach(() => window.localStorage.clear());

  it("8. saves a bridge for one identity and does not apply it to another", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    act(() => {
      result.current.saveWeightBridge({
        sourceKind: "reference",
        sourceKey: "טחינה",
        unit: "כף",
        gramsPerUnit: 15,
        provenance: "user_measured",
      });
    });
    expect(result.current.weightBridges).toHaveLength(1);
    expect(result.current.weightBridges[0]).toMatchObject({
      sourceKey: "טחינה",
      unit: "כף",
      gramsPerUnit: 15,
      createdBy: "me",
    });
    const idx = buildBridgeIndex(result.current.weightBridges);
    expect(idx.has("reference:טחינה:כף")).toBe(true);
    expect(idx.has("reference:חמאת בוטנים:כף")).toBe(false);
    expect(idx.has("estimated:טחינה:כף")).toBe(false);

    // Re-stating the same identity+unit updates in place (one fact, not two).
    act(() => {
      result.current.saveWeightBridge({
        sourceKind: "reference",
        sourceKey: "טחינה",
        unit: "כף",
        gramsPerUnit: 18,
        provenance: "label",
      });
    });
    expect(result.current.weightBridges).toHaveLength(1);
    expect(result.current.weightBridges[0].gramsPerUnit).toBe(18);
  });
});

describe("the canonical reference is never touched (acceptance 19)", () => {
  beforeEach(() => window.localStorage.clear());

  it("19. dishes, estimated products and bridges leave the reference and the food list identical", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    // The two things DEC-036 makes canonical: the reference dataset itself and
    // the ONE active food list derived from it.
    const referenceBefore = {
      items: index.itemsById.size,
      groups: index.groups.length,
      aliases: index.aliasToGroup.size,
      version: index.version,
    };
    const foodsBefore = JSON.stringify(result.current.foods);

    act(() => {
      const product = result.current.saveEstimatedProduct({
        name: "רוטב מהסופר",
        label: { basis: "per_100g", calories: 350, saturatedFatG: 12 },
      });
      result.current.saveWeightBridge({
        sourceKind: "estimated",
        sourceKey: product.id,
        unit: "כף",
        gramsPerUnit: 15,
        provenance: "user_measured",
      });
    });
    const product = result.current.estimatedProducts[0];
    const estimated = resolveIngredient(
      { sourceKind: "estimated", product, amount: 100, unit: "גרם" },
      buildBridgeIndex(result.current.weightBridges),
    );
    expect(estimated.ok).toBe(true);
    if (!estimated.ok) return;
    act(() => {
      result.current.saveDish({
        name: "תבשיל מעורב",
        ingredients: [gramIngredient("תפוח אדמה", 200), estimated.ingredient],
        finalWeightG: 400,
      });
    });
    act(() => {
      result.current.logDish("lunch", {
        dishId: result.current.dishes[0].id,
        grams: 200,
        weightSource: "weighed",
      });
    });

    // Nothing was added to, removed from or renamed in the canonical layer …
    const after = getReferenceIndex();
    expect({
      items: after.itemsById.size,
      groups: after.groups.length,
      aliases: after.aliasToGroup.size,
      version: after.version,
    }).toEqual(referenceBefore);
    // … and the active food list is byte-for-byte what it was.
    expect(JSON.stringify(result.current.foods)).toBe(foodsBefore);
    // The derived entities live in their own namespaces.
    expect(result.current.foods.some((f) => f.name === "תבשיל מעורב")).toBe(false);
    expect(result.current.foods.some((f) => f.name === "רוטב מהסופר")).toBe(false);
  });
});

describe("a dish name is unique per household (durable-queue safety)", () => {
  beforeEach(() => window.localStorage.clear());

  it("refuses a second dish of the same name instead of queueing a doomed write", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    act(() => {
      result.current.saveDish({
        name: "תבשיל עדשים",
        ingredients: [gramIngredient("תפוח אדמה", 200)],
        finalWeightG: 400,
      });
    });
    // `dishes.normalized_name` is unique per household: a duplicate would be
    // rejected for good (23505) and would quarantine the servings logged from
    // it (23503), so the store refuses it up front.
    expect(() =>
      result.current.saveDish({
        name: "  תבשיל   עדשים ",
        ingredients: [gramIngredient("תפוח אדמה", 100)],
        finalWeightG: 200,
      }),
    ).toThrow(DuplicateDishNameError);
    expect(result.current.allDishes).toHaveLength(1);

    // An ARCHIVED dish still owns its name in the database.
    act(() => result.current.setDishActive(result.current.dishes[0].id, false));
    expect(result.current.dishes).toHaveLength(0);
    expect(result.current.findDishByName("תבשיל עדשים")).toBeDefined();
    expect(() =>
      result.current.saveDish({
        name: "תבשיל עדשים",
        ingredients: [gramIngredient("תפוח אדמה", 100)],
        finalWeightG: 200,
      }),
    ).toThrow(DuplicateDishNameError);

    // Editing the dish itself is of course still allowed, and an archived dish
    // that is edited stays archived.
    const id = result.current.allDishes[0].id;
    act(() => {
      result.current.saveDish({
        id,
        name: "תבשיל עדשים",
        ingredients: [gramIngredient("תפוח אדמה", 300)],
        finalWeightG: 400,
      });
    });
    expect(result.current.allDishes).toHaveLength(1);
    expect(result.current.allDishes[0].revision).toBe(2);
    expect(result.current.allDishes[0].isActive).toBe(false);
    expect(result.current.dishes).toHaveLength(0);
  });
});

describe("manual target isolation in the store", () => {
  beforeEach(() => window.localStorage.clear());

  it("1/4/5. the manual target is per profile, never leaks, and null stays null", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current.getPointsBudget("me")).toBeNull();
    expect(result.current.getPointsBudgetInfo("me").source).toBe("none");

    act(() => result.current.setPointsBudget(27));
    expect(result.current.getPointsBudget("me")).toBe(27);
    // 5. the partner's target is untouched.
    expect(result.current.getPointsBudget("elena")).toBeNull();

    act(() => result.current.setActiveProfile("elena"));
    act(() => result.current.setPointsBudget(31));
    expect(result.current.getPointsBudget("elena")).toBe(31);
    expect(result.current.getPointsBudget("me")).toBe(27);

    // 2/3. body facts and weigh-ins do not move it.
    act(() => {
      result.current.addWeighIn({ dateISO: today(), weightKg: 91 });
      result.current.setProfileFacts({
        sexAtBirth: "male",
        heightCm: 190,
        birthDate: "1970-01-01",
      });
    });
    expect(result.current.getPointsBudget("elena")).toBe(31);

    // Clearing goes back to "no target", not to an automatic value.
    act(() => result.current.setPointsBudget(null));
    expect(result.current.getPointsBudget("elena")).toBeNull();
    expect(result.current.getPointsBudgetInfo("elena").source).toBe("none");
  });

  it("4. logging works with no target configured", () => {
    const { result } = renderHook(() => useStore(), { wrapper });
    act(() => {
      result.current.addEntry("lunch", {
        foodId: result.current.foods.find((f) => f.name === "תפוח עץ")!.id,
        foodName: "תפוח עץ",
        mode: "measured",
        amount: 100,
        unit: "גרם",
      });
    });
    expect(result.current.getDay("me", today()).meals.lunch.entries).toHaveLength(1);
    expect(result.current.getPointsBudget("me")).toBeNull();
  });
});
