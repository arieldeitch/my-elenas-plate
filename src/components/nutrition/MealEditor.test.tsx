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
    // DEC-036: "תפוח" is a verified alias of the reference food תפוח עץ, which
    // ranks first (exact alias) above the תפוח אדמה prefix matches — ONE card.
    const results = await screen.findAllByTestId("search-result");
    expect(results[0]).toHaveAccessibleName("תפוח עץ, פתיחת בחירת כמות");
    expect(results[0]).toHaveAttribute("data-direct", "false");
    expect(within(results[0]).getByTestId("result-alias")).toHaveTextContent("נמצא לפי: תפוח");
    expect(results.filter((r) => within(r).queryByText("תפוח עץ"))).toHaveLength(1);
    await user.click(results[0]);
    expect(screen.getByRole("button", { name: "הוספת המאכל" })).toBeInTheDocument();
    expect(screen.getByTestId("points-preview")).toHaveAttribute("data-points", "2");
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    const row = within(screen.getByTestId("meal-entries")).getByTestId("meal-entry");
    expect(within(row).getByText("תפוח עץ")).toBeInTheDocument();
    expect(row).toHaveAttribute("data-quantity", "100 גרם");
    expect(search()).toHaveValue("");
    expect(store!.getDay("me", isoToday()).meals.dinner.entries[0].loggedAt).toMatch(/^\d{4}-/);

    await user.click(screen.getByRole("button", { name: "מחיקה: תפוח עץ" }));
    expect(screen.queryByTestId("meal-entries")).not.toBeInTheDocument();
  });

  it("recent chips and typed results share one path: usual quantity, active person only", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(search(), "ביצה");
    await user.click((await screen.findAllByTestId("search-result"))[0]);
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));

    // Now a chip exists under "אחרונים" — one tap adds it too, no quantity step.
    expect(screen.getByText("אחרונים")).toBeInTheDocument();
    expect(screen.getByTestId("quick-add-hint")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ביצה, הוספה של 1 יחידה" }));

    expect(screen.queryByRole("button", { name: "הוספת המאכל" })).not.toBeInTheDocument();
    const rows = within(screen.getByTestId("meal-entries")).getAllByText("ביצה");
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

  it("a weight-first food (אבוקדו → 30 גרם) has no trusted default: the result opens the quantity screen", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(search(), "אבוקדו");
    const result = (await screen.findAllByTestId("search-result"))[0];
    expect(result).toHaveAttribute("data-direct", "false");
    expect(result).toHaveAccessibleName(/^אבוקדו, פתיחת בחירת כמות/);
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

    // "סלט ירקות" is a verified alias of the reference food ירקות (0 at any quantity).
    await user.type(search(), "סלט ירקות");
    await user.click((await screen.findAllByTestId("search-result"))[0]);
    await user.click(screen.getByRole("tab", { name: "לפי תחושה" }));
    await user.click(screen.getByRole("button", { name: "יותר מדי" }));
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));

    const entries = screen.getByTestId("meal-entries");
    expect(within(entries).getByText("ירקות")).toBeInTheDocument();
    expect(within(entries).getByText("הרבה")).toBeInTheDocument();
  });

  it("the full editor still offers the food's own units, defaulting to the sensible one", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(search(), "לחם דגנים");
    await user.click((await screen.findAllByTestId("search-result"))[0]);

    // לחם דגנים (1 פרוסה / 30 גרם) offers exactly the units its reference portion resolves.
    expect(screen.getByRole("button", { name: "פרוסה" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "גרם" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "חצי יחידה" })).not.toBeInTheDocument();
  });

  it("reuses the existing food instead of creating a punctuation duplicate", async () => {
    const user = userEvent.setup();
    renderEditor();

    // Typing צ׳יה (Hebrew geresh) must resolve to the reference row זרעי צ'יה — no "new" offer.
    await user.type(search(), "צ׳יה");

    expect(await screen.findByRole("button", { name: /זרעי צ/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /קישור לשם אישי/ })).not.toBeInTheDocument();
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

  it("an unknown name becomes a PERSONAL ALIAS of a reference food — never a food with its own points (DEC-036)", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(search(), "מאפין קינמון ביתי");
    await user.click(await screen.findByRole("button", { name: /קישור לשם אישי/ }));
    const form = screen.getByTestId("personal-alias-form");
    expect(form).toBeInTheDocument();
    // Nothing exists yet; the save is disabled until a reference food is picked.
    expect(store!.foods.some((f) => f.name === "מאפין קינמון ביתי")).toBe(false);
    expect(screen.getByTestId("pa-save")).toBeDisabled();
    await user.clear(screen.getByLabelText("המאכל במאגר"));
    await user.type(screen.getByLabelText("המאכל במאגר"), "מאפין");
    const option = (await screen.findAllByTestId("pa-option")).find((o) =>
      within(o).queryByText("מאפין שוקולד"),
    )!;
    await user.click(option);
    await user.click(screen.getByTestId("pa-save"));
    // The quantity screen is the reference food's (1 יחידה / 45 גרם = 5): no card of its own.
    expect(screen.getByRole("button", { name: "הוספת המאכל" })).toBeInTheDocument();
    expect(screen.getByTestId("reference-line")).toHaveTextContent(
      "מנת ייחוס: 1 יחידה (45 גרם) = 5 נק׳",
    );
    expect(store!.foods.some((f) => f.name === "מאפין קינמון ביתי")).toBe(false);
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    const row = screen.getByTestId("meal-entry");
    expect(within(row).getByText("מאפין שוקולד")).toBeInTheDocument();
    expect(row).toHaveAttribute("data-points", "5");
    // The personal name now FINDS the reference food (and its chip is the reference food's).
    expect(
      screen.getByRole("button", { name: "מאפין שוקולד, הוספה של 1 יחידה" }),
    ).toBeInTheDocument();
    await user.type(search(), "מאפין קינמון ביתי");
    const hit = (await screen.findAllByTestId("search-result"))[0];
    expect(within(hit).getByText("מאפין שוקולד")).toBeInTheDocument();
    expect(within(hit).getByTestId("result-alias")).toHaveTextContent(
      "נמצא לפי: מאפין קינמון ביתי",
    );
  });

  it("a recent chip for a weight-first food opens the quantity screen too (one rule for chips and results)", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.type(search(), "אבוקדו");
    await user.click((await screen.findAllByTestId("search-result"))[0]);
    await user.click(screen.getByRole("button", { name: "גרם" }));
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "150");
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    expect(screen.getByTestId("meal-entry")).toHaveAttribute("data-quantity", "150 גרם");
    expect(screen.getByTestId("meal-entry")).toHaveAttribute("data-points", "5"); // 30 גרם = 1 → 150 גרם = 5

    // The recent chip announces the fallback and opens the quantity screen.
    const chip = screen.getByRole("button", { name: "אבוקדו, פתיחת בחירת כמות" });
    expect(chip).toHaveAttribute("data-direct", "false");
    await user.click(chip);
    expect(screen.getByRole("button", { name: "הוספת המאכל" })).toBeInTheDocument();
    expect(store!.getDay("me", isoToday()).meals.dinner.entries).toHaveLength(1);
  });
});
