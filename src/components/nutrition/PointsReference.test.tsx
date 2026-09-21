/**
 * DEC-035 UI acceptance (jsdom): the search shows the reference line, a food
 * with several portions opens the variant picker, the quantity screen shows
 * the reference portion and refuses an unsafe unit, and a new food goes
 * through the confirmation form with "הצעה לבדיקה" suggestions.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { DEVICE_PROFILE_KEY } from "@/lib/device-profile";
import { MealEditor } from "./MealEditor";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

let store: ReturnType<typeof useStore> | null = null;
function Probe() {
  store = useStore();
  return null;
}

function renderEditor() {
  return render(
    <>
      <MealEditor slot="lunch" onClose={vi.fn()} />
      <Probe />
    </>,
    { wrapper },
  );
}

const search = () => screen.getByRole("textbox", { name: "חיפוש מאכל" });

describe("points reference in the meal editor", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
    store = null;
  });

  it("a result shows portion · points · category on its secondary line; conflict rows are absent", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(search(), "אבוקדו");
    const result = (await screen.findAllByTestId("search-result")).find((r) =>
      within(r).queryByText("אבוקדו"),
    )!;
    expect(within(result).getByTestId("result-detail")).toHaveTextContent(
      "30 גרם · 1 נק׳ · שומנים",
    );

    await user.clear(search());
    await user.type(search(), "יוגורט טבעי 2.9%");
    const names = (await screen.findAllByTestId("search-result")).map((r) => r.textContent);
    expect(names.some((n) => n?.includes("יוגורט טבעי 2.9% שומן -200ג, 2"))).toBe(false);
  });

  it("several portions → the picker, then the quantity screen with the chosen reference and its units", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(search(), "אגוז ברזיל");
    const result = (await screen.findAllByTestId("search-result")).find((r) =>
      within(r).queryByText("אגוז ברזיל"),
    )!;
    expect(within(result).getByTestId("result-detail")).toHaveTextContent(
      "2 כמויות · 1–19 נק׳ · שומנים",
    );
    await user.click(result);
    const picker = screen.getByTestId("variant-picker");
    const options = within(picker).getAllByTestId("variant-option");
    expect(options.map((o) => o.textContent)).toEqual([
      "2 יחידה1 נק׳ · שומנים",
      "100 גרם19 נק׳ · שומנים",
    ]);
    await user.click(options[0]);
    expect(screen.getByTestId("reference-line")).toHaveTextContent(
      "מנת ייחוס: 2 יחידה = 1 נק׳ · שומנים",
    );
    // Prefilled with the portion itself; preview is the exact reference value.
    expect(screen.getByRole("spinbutton")).toHaveValue(2);
    expect(screen.getByTestId("points-preview")).toHaveAttribute("data-points", "1");
    expect(screen.getByTestId("points-preview")).toHaveAttribute("data-basis", "reference:exact");
    // Only resolvable units are offered for this portion.
    expect(screen.getAllByTestId("unit-option").map((u) => u.textContent)).toEqual(["יחידה"]);
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "6");
    expect(screen.getByTestId("points-preview")).toHaveAttribute("data-points", "3");
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    const entry = store!.getDay("me", new Date().toISOString().slice(0, 10)).meals.lunch.entries[0];
    expect(entry).toMatchObject({
      pointsValue: 3,
      pointsBasis: "reference:scaled",
      amount: 6,
      unit: "יחידה",
    });
    expect(entry.referenceItemId).toBeDefined();
  });

  it("an unsafe unit (cup for a gram portion) is refused with an explanation — never converted", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(search(), "אבוקדו");
    const result = (await screen.findAllByTestId("search-result")).find((r) =>
      within(r).queryByText("אבוקדו"),
    )!;
    await user.click(result);
    expect(screen.getByRole("spinbutton")).toHaveValue(30);
    await user.click(screen.getByRole("button", { name: "יחידות נוספות" }));
    await user.click(screen.getByRole("button", { name: "כוס" }));
    const preview = screen.getByTestId("points-preview");
    expect(preview).toHaveAttribute("data-points", "blocked");
    expect(preview).toHaveTextContent("אין המרה אוטומטית");
    expect(screen.getByRole("button", { name: "הוספת המאכל" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "גרם" }));
    expect(screen.getByTestId("points-preview")).toHaveAttribute("data-points", "1");
  });

  it("an unknown food: suggestions are 'הצעה לבדיקה' with source + confidence, and saving requires confirmation", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(search(), "יוגורט טבעי 4%");
    await user.click(await screen.findByRole("button", { name: /כמאכל חדש/ }));
    const form = screen.getByTestId("new-food-form");
    const suggestions = within(form).getAllByTestId("nf-suggestion");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toHaveAttribute("data-confidence");
    // Confirm without points → refused.
    await user.selectOptions(screen.getByLabelText("קטגוריה"), "מוצרי חלב");
    await user.click(screen.getByTestId("nf-confirm"));
    expect(screen.getByText(/יש להזין ניקוד/)).toBeInTheDocument();
    // Take a suggestion: the source is shown, the person still confirms.
    await user.click(suggestions[0]);
    expect(screen.getByTestId("nf-suggestion-source")).toHaveTextContent("הצעה לבדיקה על בסיס");
    expect(store!.foods.some((f) => f.name === "יוגורט טבעי 4%")).toBe(false);
    await user.click(screen.getByTestId("nf-confirm"));
    const created = store!.foods.find((f) => f.name === "יוגורט טבעי 4%")!;
    expect(created.pointsStatus).toBe("confirmed");
    expect(created.createdBy).toBe("me");
    expect(screen.getByTestId("points-preview")).toHaveAttribute("data-basis", "custom:confirmed");
  });
});
