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
  // `dinner` starts empty in the demo seed for the active profile (אריאל).
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
    // Search results appear after the 180ms debounce — findBy waits for them.
    await user.click(await screen.findByRole("button", { name: /תפוח/ }));
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    await user.click(screen.getByRole("button", { name: "חזרה לארוחה" }));

    const row = screen.getByText("תפוח").closest("div")!.parentElement!;
    expect(within(row).getByText(/יחידה/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "מחיקה" }));
    expect(screen.getByText("עוד לא תועדו מאכלים בארוחה הזו.")).toBeInTheDocument();
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
