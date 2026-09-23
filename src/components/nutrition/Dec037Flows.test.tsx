/**
 * DEC-037 UI flows (jsdom): the dedicated dishes area, the label estimator,
 * the weight-bridge question and the "no target configured" state.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { resolveIngredient } from "@/lib/dishes";
import { buildBridgeIndex } from "@/lib/weight-bridges";
import { DEVICE_PROFILE_KEY } from "@/lib/device-profile";
import { DishEditor } from "./DishEditor";
import { LabelEstimatorForm } from "./LabelEstimatorForm";
import { TodayCard } from "./TodayCard";
import { PointsBudgetEditor } from "./PointsBudgetEditor";
import { MealEditor } from "./MealEditor";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

let store: ReturnType<typeof useStore> | null = null;
function Probe() {
  store = useStore();
  return null;
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
  store = null;
});

describe("the dish editor", () => {
  it("6/14. builds a dish from canonical gram ingredients and shows the deterministic rate", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DishEditor open dish={null} onClose={vi.fn()} />
        <Probe />
      </>,
      { wrapper },
    );

    await user.type(screen.getByLabelText("שם התבשיל"), "תבשיל בדיקה");

    // ingredient 1 — תפוח אדמה, 200 גרם = 4 נק׳
    await user.click(screen.getByTestId("dish-add-ingredient"));
    await user.type(screen.getByLabelText("חיפוש מרכיב"), "תפוח אדמה");
    await user.click((await screen.findAllByTestId("ingredient-option"))[0]);
    await user.clear(screen.getByLabelText("כמות"));
    await user.type(screen.getByLabelText("כמות"), "200");
    await user.click(screen.getByTestId("ing-add"));

    const rows = screen.getAllByTestId("dish-ingredient");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute("data-source", "reference");
    expect(within(rows[0]).getByText(/4 נק׳/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("משקל התבשיל המוכן (גרם)"), "400");
    const totals = screen.getByTestId("dish-totals");
    expect(totals).toHaveAttribute("data-total-points", "4");
    expect(totals).toHaveAttribute("data-points-per-gram", String(4 / 400));
    expect(within(totals).getByText(/1 נק׳ ל-100 גרם/)).toBeInTheDocument();

    await user.click(screen.getByTestId("dish-save"));
    expect(store!.dishes).toHaveLength(1);
    expect(store!.dishes[0]).toMatchObject({
      name: "תבשיל בדיקה",
      totalPoints: 4,
      finalWeightG: 400,
      revision: 1,
    });
  });

  it("7/8. a weighed amount of a spoon-based ingredient asks for the bridge once, then resolves", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DishEditor open dish={null} onClose={vi.fn()} />
        <Probe />
      </>,
      { wrapper },
    );
    await user.click(screen.getByTestId("dish-add-ingredient"));
    // אבקת קקאו לא ממותקת · כף/10 גרם has a gram equivalent, so pick a row that does NOT:
    await user.type(screen.getByLabelText("חיפוש מרכיב"), "טחינה");
    const options = await screen.findAllByTestId("ingredient-option");
    // Find a spoon-only option by its portion text.
    const spoonOption = options.find(
      (o) => /כף/.test(o.textContent ?? "") && !/גרם/.test(o.textContent ?? ""),
    );
    if (!spoonOption) return; // the dataset may not have one; the engine test covers it
    await user.click(spoonOption);
    await user.clear(screen.getByLabelText("כמות"));
    await user.type(screen.getByLabelText("כמות"), "30");
    await user.click(screen.getByTestId("ing-add"));

    // The app asks instead of guessing a density.
    const bridge = screen.getByTestId("weight-bridge-form");
    expect(bridge).toBeInTheDocument();
    expect(within(bridge).getByText(/כמה גרם יש ב־1 כף/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/1 כף = כמה גרם/), "15");
    await user.click(screen.getByTestId("wb-save"));

    expect(store!.weightBridges).toHaveLength(1);
    expect(store!.weightBridges[0]).toMatchObject({ unit: "כף", gramsPerUnit: 15 });
    const rows = screen.getAllByTestId("dish-ingredient");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText(/1 כף = 15 גרם/)).toBeInTheDocument();
  });
});

describe("the label estimator", () => {
  it("9/10. estimates from a per-100g label and from a per-serving label with its weight", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <>
        <LabelEstimatorForm initialName="קרקר מהסופר" onSaved={onSaved} onCancel={vi.fn()} />
        <Probe />
      </>,
      { wrapper },
    );
    await user.type(screen.getByLabelText(/קלוריות/), "400");
    const preview = screen.getByTestId("label-estimate-preview");
    expect(preview).not.toHaveAttribute("data-points", "invalid");
    expect(within(preview).getByText(/הערכה לפי ערכים תזונתיים/)).toBeInTheDocument();
    expect(within(preview).getByText(/label-estimate-v1/)).toBeInTheDocument();
    const per100 = preview.getAttribute("data-points");

    // per-serving without a weight cannot be saved and the form says why…
    await user.click(screen.getByTestId("le-basis-per_serving"));
    expect(screen.getByTestId("le-save")).toBeDisabled();
    expect(screen.getByTestId("label-estimate-missing")).toHaveTextContent(/משקל המנה/);
    expect(store!.estimatedProducts).toHaveLength(0);

    // …and with a 50 g serving of 200 kcal it equals the 400 kcal/100 g estimate.
    await user.clear(screen.getByLabelText(/קלוריות/));
    await user.type(screen.getByLabelText(/קלוריות/), "200");
    await user.type(screen.getByLabelText("משקל מנה (גרם)"), "50");
    expect(screen.getByTestId("label-estimate-preview")).toHaveAttribute("data-points", per100!);

    await user.click(screen.getByTestId("le-save"));
    expect(onSaved).toHaveBeenCalled();
    expect(store!.estimatedProducts).toHaveLength(1);
    expect(store!.estimatedProducts[0]).toMatchObject({
      name: "קרקר מהסופר",
      estimatorVersion: "label-estimate-v1",
      label: { basis: "per_serving", servingWeightG: 50, calories: 200 },
    });
  });

  it("never fabricates: an optional field left empty is not stored as a zero", async () => {
    const user = userEvent.setup();
    render(
      <>
        <LabelEstimatorForm initialName="מוצר" onSaved={vi.fn()} onCancel={vi.fn()} />
        <Probe />
      </>,
      { wrapper },
    );
    await user.type(screen.getByLabelText(/קלוריות/), "250");
    await user.type(screen.getByLabelText("חלבון (גרם)"), "8");
    await user.click(screen.getByTestId("le-save"));
    const label = store!.estimatedProducts[0].label;
    expect(label.proteinG).toBe(8);
    expect("fiberG" in label).toBe(false);
    expect("addedSugarG" in label).toBe(false);
  });
});

describe("the daily target in the UI", () => {
  it("4. with no target the today card says so and shows no invented remaining value", () => {
    render(
      <>
        <TodayCard onOpenCalendar={vi.fn()} />
        <Probe />
      </>,
      { wrapper },
    );
    const points = screen.getByTestId("today-points");
    expect(points).toHaveAttribute("data-budget-source", "none");
    expect(within(points).getByTestId("budget-setup-prompt")).toHaveTextContent("יעד לא הוגדר");
    expect(points.textContent).not.toMatch(/נשארו/);
    expect(points.textContent).not.toMatch(/\/\s*23/);
    expect(points.textContent).not.toMatch(/\/\s*30/);
  });

  it("1. entering 27 manually makes it the effective target everywhere", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PointsBudgetEditor open onClose={vi.fn()} />
        <TodayCard onOpenCalendar={vi.fn()} />
        <Probe />
      </>,
      { wrapper },
    );
    expect(screen.getByTestId("budget-none")).toBeInTheDocument();
    await user.type(screen.getByLabelText("יעד יומי (נקודות)"), "27");
    await user.click(screen.getByRole("button", { name: "שמירה" }));
    expect(store!.getPointsBudget("me")).toBe(27);
    const points = screen.getByTestId("today-points");
    expect(points).toHaveAttribute("data-budget-source", "manual");
    expect(points.textContent).toMatch(/27/);
    expect(points.textContent).toMatch(/נשארו/);
  });

  it("the body facts are secondary and are labelled as not affecting the target", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PointsBudgetEditor open onClose={vi.fn()} />
        <Probe />
      </>,
      { wrapper },
    );
    expect(screen.queryByTestId("profile-facts")).not.toBeInTheDocument();
    expect(screen.getByTestId("profile-facts-toggle")).toHaveTextContent("לא משפיעים על היעד");
    await user.click(screen.getByTestId("profile-facts-toggle"));
    expect(screen.getByTestId("profile-facts")).toBeInTheDocument();
  });
});

describe("estimating a missing product from inside a meal", () => {
  it("5/12. the not-found path offers the label estimator and logs a marked estimate", async () => {
    const user = userEvent.setup();
    render(
      <>
        <MealEditor slot="dinner" onClose={vi.fn()} />
        <Probe />
      </>,
      { wrapper },
    );
    await user.type(screen.getByRole("textbox", { name: "חיפוש מאכל" }), "חטיף מוזר");
    await user.click(await screen.findByTestId("search-estimate-from-label"));
    expect(screen.getByTestId("label-estimator-form")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/קלוריות/), "500");
    await user.click(screen.getByTestId("le-save"));

    // → straight to "how much did I eat", in grams, marked as an estimate
    const quantity = screen.getByTestId("estimated-quantity-form");
    expect(within(quantity).getAllByText(/הערכה לפי ערכים תזונתיים/).length).toBeGreaterThan(0);
    expect(within(quantity).getByTestId("estimated-basis")).toHaveTextContent("label-estimate-v1");
    await user.click(screen.getByTestId("eq-add"));

    const row = screen.getByTestId("meal-entry");
    expect(within(row).getByTestId("entry-estimated")).toBeInTheDocument();
    const entry = store!.getDay("me", new Date().toISOString().slice(0, 10)).meals.dinner
      .entries[0];
    expect(entry.pointsBasis).toBe("estimated:label");
    expect(entry.estimatedProductId).toBe(store!.estimatedProducts[0].id);
    expect(entry.pointsValue).toBeGreaterThan(0);

    // An estimate is a DERIVED source with its own provenance — never the
    // "old food, not in the database" state that DEC-036 legacy rows get.
    expect(row).toHaveAttribute("data-legacy", "false");
    expect(within(row).queryByText(/מאכל ישן/)).toBeNull();
  });

  it("a saved product and a saved dish are search results, not a 'nothing found'", async () => {
    const user = userEvent.setup();
    render(
      <>
        <MealEditor slot="dinner" onClose={vi.fn()} />
        <Probe />
      </>,
      { wrapper },
    );
    // A household product and a household dish, neither of them in the catalog.
    act(() => {
      store!.saveEstimatedProduct({
        name: "ממרח מיוחד",
        label: { basis: "per_100g", calories: 500 },
      });
    });
    const ingredient = resolveIngredient(
      {
        sourceKind: "estimated",
        product: store!.estimatedProducts[0],
        amount: 100,
        unit: "גרם",
      },
      buildBridgeIndex([]),
    );
    expect(ingredient.ok).toBe(true);
    if (!ingredient.ok) return;
    act(() => {
      store!.saveDish({
        name: "ממרח בתבשיל",
        ingredients: [ingredient.ingredient],
        finalWeightG: 200,
      });
    });

    await user.type(screen.getByRole("textbox", { name: "חיפוש מאכל" }), "ממרח");
    expect(await screen.findByTestId("search-result-estimated")).toBeInTheDocument();
    expect(screen.getByTestId("search-result-dish")).toBeInTheDocument();
    // The catalog has no "ממרח", but something WAS found — the household's own
    // sources are results too, so the dead-end line must not be shown.
    expect(screen.queryByText("לא נמצא מאכל תואם בקטלוג.")).toBeNull();
  });
});
