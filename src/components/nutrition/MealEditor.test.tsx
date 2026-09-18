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

  it("adds a searched food (3 taps: result → confirm) and can delete it", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(search(), "תפוח");
    // Search results appear after the 180ms debounce — findAllBy waits for them.
    // "תפוח" also prefixes תפוח אדמה / תפוחי אדמה, and the exact match ranks first.
    const results = await screen.findAllByRole("button", { name: /תפוח/ });
    expect(results[0]).toHaveAccessibleName(/^תפוח /);
    await user.click(results[0]);
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));

    const entries = screen.getByTestId("meal-entries");
    const row = within(entries).getByTestId("meal-entry");
    expect(within(row).getByText("תפוח")).toBeInTheDocument();
    expect(row).toHaveAttribute("data-quantity", "1 יחידה");
    expect(store!.getDay("me", isoToday()).meals.dinner.entries[0].loggedAt).toMatch(/^\d{4}-/);

    await user.click(screen.getByRole("button", { name: "מחיקה: תפוח" }));
    expect(screen.queryByTestId("meal-entries")).not.toBeInTheDocument();
  });

  it("quick-adds a recent food in one tap with its usual quantity, for the active person only", async () => {
    const user = userEvent.setup();
    renderEditor();

    // First time: through search + confirm (this makes תפוח a recent).
    await user.type(search(), "תפוח");
    await user.click((await screen.findAllByRole("button", { name: /^תפוח / }))[0]);
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    await user.clear(search());

    // Now a chip exists under "אחרונים" — one tap adds it, no quantity step.
    expect(screen.getByText("אחרונים")).toBeInTheDocument();
    expect(screen.getByTestId("quick-add-hint")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "תפוח" }));

    expect(screen.queryByRole("button", { name: "הוספת המאכל" })).not.toBeInTheDocument();
    const rows = within(screen.getByTestId("meal-entries")).getAllByText("תפוח");
    expect(rows).toHaveLength(2);
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

  it("starts with no favorites and no recents, and caps the result list", async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(screen.queryByText("מועדפים")).not.toBeInTheDocument();
    expect(screen.queryByText("אחרונים")).not.toBeInTheDocument();

    // A very common letter matches most of the catalog; the list stays capped.
    await user.type(search(), "ה");
    const results = await screen.findAllByRole("button", { name: /./ });
    const catalogRows = results.filter((b) => b.className.includes("border-border"));
    expect(catalogRows.length).toBeLessThanOrEqual(20);
  });

  it("supports the subjective quantity mode for a catalog food", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(search(), "סלט ירקות");
    await user.click((await screen.findAllByRole("button", { name: /סלט ירקות/ }))[0]);

    await user.click(screen.getByRole("tab", { name: "תחושה" }));
    await user.click(screen.getByRole("button", { name: "הרבה" }));
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));

    const entries = screen.getByTestId("meal-entries");
    expect(within(entries).getByText("סלט ירקות")).toBeInTheDocument();
    expect(within(entries).getByText("הרבה")).toBeInTheDocument();
  });

  it("offers the food's own units, defaulting to the sensible one", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(search(), "גבינה צהובה");
    await user.click((await screen.findAllByRole("button", { name: /גבינה צהובה/ }))[0]);

    // גבינה צהובה is logged by the slice, not by the piece.
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
