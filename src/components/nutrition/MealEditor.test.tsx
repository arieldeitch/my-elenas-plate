import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { MealEditor } from "./MealEditor";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

function renderEditor() {
  // `dinner` is empty for a fresh store: there is no seeded data any more.
  return render(<MealEditor slot="dinner" onClose={vi.fn()} />, { wrapper });
}

describe("MealEditor", () => {
  beforeEach(() => window.localStorage.clear());

  it("labels the dialog with the slot name and shows the empty state", () => {
    renderEditor();
    expect(screen.getByRole("dialog", { name: "ארוחת ערב" })).toBeInTheDocument();
    expect(screen.getByText("עוד לא תועדו מאכלים בארוחה הזו.")).toBeInTheDocument();
  });

  it("adds a coffee through the fast path and shows its summary", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getAllByRole("button", { name: "הוספת מאכל" })[0]);
    await user.click(screen.getByRole("button", { name: /הוספת קפה מהירה/ }));
    await user.click(screen.getByRole("button", { name: "הוספת הקפה" }));
    await user.click(screen.getByRole("button", { name: "חזרה לארוחה" }));

    expect(screen.getByText("קפה")).toBeInTheDocument();
    expect(screen.getByText(/אמריקנו · ללא חלב/)).toBeInTheDocument();
  });

  it("adds a searched food and can delete it", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getAllByRole("button", { name: "הוספת מאכל" })[0]);
    await user.type(screen.getByRole("textbox", { name: "חיפוש מאכל" }), "תפוח");
    // Search results appear after the 180ms debounce — findAllBy waits for them.
    // "תפוח" also prefixes תפוח אדמה / תפוחי אדמה, and the exact match ranks first.
    const results = await screen.findAllByRole("button", { name: /תפוח/ });
    // The result's accessible name is "<food> <category>", so a trailing space
    // pins this to תפוח itself rather than תפוחי אדמה.
    expect(results[0]).toHaveAccessibleName(/^תפוח /);
    await user.click(results[0]);
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    await user.click(screen.getByRole("button", { name: "חזרה לארוחה" }));

    const row = screen.getByText("תפוח").closest("div")!.parentElement!;
    expect(within(row).getByText(/יחידה/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "מחיקה" }));
    expect(screen.getByText("עוד לא תועדו מאכלים בארוחה הזו.")).toBeInTheDocument();
  });

  it("starts with no favorites and no recents, and caps the result list", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getAllByRole("button", { name: "הוספת מאכל" })[0]);
    // Nothing has been logged yet, so neither section exists.
    expect(screen.queryByText("מועדפים")).not.toBeInTheDocument();
    expect(screen.queryByText("אחרונים")).not.toBeInTheDocument();

    // A very common letter matches most of the catalog; the list stays capped.
    await user.type(screen.getByRole("textbox", { name: "חיפוש מאכל" }), "ה");
    const results = await screen.findAllByRole("button", { name: /./ });
    const catalogRows = results.filter((b) => b.className.includes("border-border"));
    expect(catalogRows.length).toBeLessThanOrEqual(20);
  });

  it("supports the subjective quantity mode for a catalog food", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getAllByRole("button", { name: "הוספת מאכל" })[0]);
    await user.type(screen.getByRole("textbox", { name: "חיפוש מאכל" }), "סלט ירקות");
    await user.click((await screen.findAllByRole("button", { name: /סלט ירקות/ }))[0]);

    await user.click(screen.getByRole("tab", { name: "תחושה" }));
    await user.click(screen.getByRole("button", { name: "הרבה" }));
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    await user.click(screen.getByRole("button", { name: "חזרה לארוחה" }));

    expect(screen.getByText("סלט ירקות")).toBeInTheDocument();
    expect(screen.getByText("הרבה")).toBeInTheDocument();
  });

  it("offers the food's own units, defaulting to the sensible one", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getAllByRole("button", { name: "הוספת מאכל" })[0]);
    await user.type(screen.getByRole("textbox", { name: "חיפוש מאכל" }), "גבינה צהובה");
    await user.click((await screen.findAllByRole("button", { name: /גבינה צהובה/ }))[0]);

    // גבינה צהובה is logged by the slice, not by the piece.
    expect(screen.getByRole("button", { name: "פרוסה" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "גרם" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "חצי יחידה" })).not.toBeInTheDocument();
  });

  it("reuses the existing food instead of creating a punctuation duplicate", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getAllByRole("button", { name: "הוספת מאכל" })[0]);
    // Typing קוטג' (straight apostrophe) must resolve to the catalog's קוטג׳.
    await user.type(screen.getByRole("textbox", { name: "חיפוש מאכל" }), "קוטג'");

    expect(await screen.findByRole("button", { name: /קוטג׳/ })).toBeInTheDocument();
    // No "create as a new food" offer, because it already exists.
    expect(screen.queryByRole("button", { name: /כמאכל חדש/ })).not.toBeInTheDocument();
  });

  it("marks the meal as not eaten and can undo the skip", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getAllByRole("button", { name: "לא נאכלה ארוחה" })[0]);
    expect(screen.getByText("לא נאכלה ארוחה")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ביטול הסימון" }));
    expect(screen.getByText("עוד לא תועדו מאכלים בארוחה הזו.")).toBeInTheDocument();
  });
});
