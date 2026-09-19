import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
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
  // `dinner` is empty for a fresh store: there is no seeded data any more.
  return render(
    <>
      <MealEditor slot="dinner" onClose={vi.fn()} />
      <Probe />
    </>,
    { wrapper },
  );
}

const search = () => screen.getByRole("textbox", { name: "חיפוש מאכל" });

describe("MealEditor (M2 one-screen logging loop)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
    store = null;
  });

  it("opens straight into search for an empty meal, labelled with slot and owner", () => {
    renderEditor();
    const dialog = screen.getByRole("dialog", { name: "ארוחת ערב · אריאל" });
    expect(dialog).toHaveAttribute("data-owner", "me");
    expect(screen.getByTestId("meal-owner")).toHaveTextContent(/^אריאל · /);
    // No intermediate "add a food" screen: the search box is already there and focused.
    expect(search()).toHaveFocus();
    expect(screen.queryByRole("button", { name: "הוספת מאכל" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("meal-entries")).not.toBeInTheDocument();
    // Only one way to mark the meal as not eaten.
    expect(screen.getAllByRole("button", { name: "לא נאכלה ארוחה" })).toHaveLength(1);
  });

  it("adds a coffee through the fast path and shows its summary in the same view", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: /הוספת קפה מהירה/ }));
    await user.click(screen.getByRole("button", { name: "הוספת הקפה" }));

    const entries = screen.getByTestId("meal-entries");
    expect(within(entries).getByText("קפה")).toBeInTheDocument();
    expect(within(entries).getByText(/אמריקנו · ללא חלב/)).toBeInTheDocument();
    // Still on the meal view: search is right there for the next item.
    expect(search()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "סיום" })).toBeInTheDocument();
  });

  it("opens quantity for a typed food, adds it, then can delete it", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(search(), "תפוח");
    // Search results appear after the 180ms debounce — findAllBy waits for them.
    // "תפוח" also prefixes תפוח אדמה / תפוחי אדמה, and the exact match ranks first.
    const results = await screen.findAllByTestId("search-result");
    expect(results[0]).toHaveAccessibleName("תפוח, פתיחת בחירת כמות");
    expect(results[0]).toHaveAttribute("data-direct", "false");
    await user.click(results[0]);
    expect(screen.getByRole("button", { name: "הוספת המאכל" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    const row = within(screen.getByTestId("meal-entries")).getByTestId("meal-entry");
    expect(within(row).getByText("תפוח")).toBeInTheDocument();
    expect(row).toHaveAttribute("data-quantity", "1 יחידה");
    expect(search()).toHaveValue("");
    expect(store!.getDay("me", isoToday()).meals.dinner.entries[0].loggedAt).toMatch(/^\d{4}-/);

    await user.click(screen.getByRole("button", { name: "מחיקה: תפוח" }));
    expect(screen.queryByTestId("meal-entries")).not.toBeInTheDocument();
  });

  it("recent chips and typed results share one path: usual quantity, active person only", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(search(), "תפוח");
    await user.click((await screen.findAllByTestId("search-result"))[0]);
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));

    // Now a chip exists under "אחרונים" — one tap adds it too, no quantity step.
    expect(screen.getByText("אחרונים")).toBeInTheDocument();
    expect(screen.getByTestId("quick-add-hint")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "תפוח, הוספה של 1 יחידה" }));

    expect(screen.queryByRole("button", { name: "הוספת המאכל" })).not.toBeInTheDocument();
    const rows = within(screen.getByTestId("meal-entries")).getAllByText("תפוח");
    expect(rows).toHaveLength(2); // repeated add = a second row (existing rule)
    const day = store!.getDay("me", isoToday());
    expect(day.meals.dinner.entries).toHaveLength(2);
    expect(day.meals.dinner.entries[1]).toMatchObject({
      mode: "measured",
      amount: 1,
      unit: "יחידה",
    });
    // Ownership: nothing landed on the partner's day.
    expect(store!.getDay("elena", isoToday()).meals.dinner.entries).toHaveLength(0);
  });

  it("a weight-first food (קוטג׳ → גרם) has no trusted default: the result opens the quantity screen", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(search(), "קוטג");
    const result = (await screen.findAllByTestId("search-result"))[0];
    expect(result).toHaveAttribute("data-direct", "false");
    expect(result).toHaveAccessibleName(/^קוטג׳, פתיחת בחירת כמות/);
    await user.click(result);

    // Quantity screen, grams first — nothing was added yet.
    expect(screen.getByRole("button", { name: "הוספת המאכל" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "גרם" })).toBeInTheDocument();
    expect(screen.queryByTestId("meal-entries")).not.toBeInTheDocument();
    expect(store!.getDay("me", isoToday()).meals.dinner.entries).toHaveLength(0);
  });

  it("typed search exposes the subjective amount choices before adding", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(search(), "סלט ירקות");
    await user.click((await screen.findAllByTestId("search-result"))[0]);
    await user.click(screen.getByRole("tab", { name: "לפי תחושה" }));
    await user.click(screen.getByRole("button", { name: "יותר מדי" }));
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));

    const entries = screen.getByTestId("meal-entries");
    expect(within(entries).getByText("סלט ירקות")).toBeInTheDocument();
    expect(within(entries).getByText("הרבה")).toBeInTheDocument();
  });

  it("the full editor still offers the food's own units, defaulting to the sensible one", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(search(), "גבינה צהובה");
    await user.click((await screen.findAllByTestId("search-result"))[0]);

    // גבינה צהובה opens the quantity screen with its own suggested units.
    expect(screen.getByRole("button", { name: "פרוסה" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "גרם" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "חצי יחידה" })).not.toBeInTheDocument();
  });

  it("reuses the existing food instead of creating a punctuation duplicate", async () => {
    const user = userEvent.setup();
    renderEditor();

    // Typing קוטג' (straight apostrophe) must resolve to the catalog's קוטג׳.
    await user.type(search(), "קוטג'");

    expect(await screen.findByRole("button", { name: /קוטג׳/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /כמאכל חדש/ })).not.toBeInTheDocument();
  });

  it("marks the meal as not eaten and can undo the skip", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "לא נאכלה ארוחה" }));
    expect(screen.getByText("לא נאכלה ארוחה")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "חיפוש מאכל" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ביטול הסימון" }));
    expect(search()).toBeInTheDocument();
  });

  it("switching the person re-labels the editor — an edit can never land on the wrong day", () => {
    renderEditor();
    act(() => store!.setActiveProfile("elena"));
    const dialog = screen.getByRole("dialog", { name: "ארוחת ערב · אלנה" });
    expect(dialog).toHaveAttribute("data-owner", "elena");
    expect(screen.getByTestId("meal-owner")).toHaveTextContent(/^אלנה · /);
  });
});

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("MealEditor — direct add boundaries (M2-6)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
    store = null;
  });

  it("creating a custom food still goes through the quantity screen — never a guessed default", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(search(), "מאפין קינמון ביתי");
    await user.click(await screen.findByRole("button", { name: /כמאכל חדש/ }));
    expect(screen.getByRole("button", { name: "הוספת המאכל" })).toBeInTheDocument();
    expect(store!.getDay("me", isoToday()).meals.dinner.entries).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    expect(screen.getByTestId("meal-entry")).toHaveAttribute("data-quantity", "1 יחידה");
    // Once it exists (default unit יחידה), its chip is a trusted one-tap add like any other.
    expect(
      screen.getByRole("button", { name: "מאפין קינמון ביתי, הוספה של 1 יחידה" }),
    ).toBeInTheDocument();
  });

  it("a recent chip for a weight-first food opens the quantity screen too (one rule for chips and results)", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(search(), "קוטג");
    await user.click((await screen.findAllByTestId("search-result"))[0]);
    await user.click(screen.getByRole("button", { name: "גרם" }));
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "150");
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    expect(screen.getByTestId("meal-entry")).toHaveAttribute("data-quantity", "150 גרם");

    // The recent chip announces the fallback and opens the quantity screen.
    const chip = screen.getByRole("button", { name: "קוטג׳, פתיחת בחירת כמות" });
    expect(chip).toHaveAttribute("data-direct", "false");
    await user.click(chip);
    expect(screen.getByRole("button", { name: "הוספת המאכל" })).toBeInTheDocument();
    expect(store!.getDay("me", isoToday()).meals.dinner.entries).toHaveLength(1);
  });
});
