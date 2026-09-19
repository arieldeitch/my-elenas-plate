import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { DEVICE_PROFILE_KEY } from "@/lib/device-profile";
import { toISODate } from "@/lib/format";
import { MealEditor } from "./MealEditor";

/**
 * M2-5 — one-tap quantity adjustment on entry rows. Behaviour-level: which
 * rows get − / +, what a tap does to the store, where the floor is, and that
 * nothing leaks to another row, person or day.
 */
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
      <MealEditor slot="dinner" onClose={vi.fn()} />
      <Probe />
    </>,
    { wrapper },
  );
}
const iso = () => toISODate(new Date());
const measured = (name: string, unit: "יחידה" | "פרוסה" | "גרם" | "כוס", amount = 1) => ({
  foodId: `f_${name}`,
  foodName: name,
  mode: "measured" as const,
  amount,
  unit,
});
const row = (name: string) =>
  screen.getAllByTestId("meal-entry").find((r) => within(r).queryByText(name))! as HTMLElement;

describe("MealEditor — inline quantity stepper (M2-5)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
    store = null;
  });

  it("+ and − change only that row, with Hebrew plurals; − stops at 1 and never deletes", async () => {
    const user = userEvent.setup();
    renderEditor();
    act(() => store!.addEntry("dinner", measured("ביצה קשה", "יחידה")));
    act(() => store!.addEntry("dinner", measured("לחם", "פרוסה")));

    const egg = row("ביצה קשה");
    expect(egg).toHaveAttribute("data-quantity", "1 יחידה");
    expect(within(egg).getByRole("button", { name: "פחות ביצה קשה" })).toBeDisabled();

    await user.click(within(egg).getByRole("button", { name: "עוד ביצה קשה" }));
    expect(egg).toHaveAttribute("data-quantity", "2 יחידות");
    expect(within(egg).getByTestId("qty-value")).toHaveTextContent("2 יחידות");
    // The other row is untouched.
    expect(row("לחם")).toHaveAttribute("data-quantity", "1 פרוסה");

    await user.click(within(egg).getByRole("button", { name: "פחות ביצה קשה" }));
    expect(egg).toHaveAttribute("data-quantity", "1 יחידה");
    expect(within(egg).getByRole("button", { name: "פחות ביצה קשה" })).toBeDisabled();
    // Still two entries — the floor never deletes.
    expect(store!.getDay("me", iso()).meals.dinner.entries).toHaveLength(2);
    expect(screen.getByRole("button", { name: "מחיקה: ביצה קשה" })).toBeInTheDocument();
  });

  it("writes to the correct person / date / slot / entry, and the partner's day is unaffected", async () => {
    const user = userEvent.setup();
    renderEditor();
    act(() => store!.setActiveProfile("elena"));
    act(() => store!.addEntry("dinner", measured("ביצה קשה", "יחידה")));
    act(() => store!.addEntry("lunch", measured("ביצה קשה", "יחידה")));

    await user.click(within(row("ביצה קשה")).getByRole("button", { name: "עוד ביצה קשה" }));
    await user.click(within(row("ביצה קשה")).getByRole("button", { name: "עוד ביצה קשה" }));

    const elena = store!.getDay("elena", iso());
    expect(elena.meals.dinner.entries[0]).toMatchObject({ foodName: "ביצה קשה", amount: 3 });
    expect(elena.meals.lunch.entries[0]).toMatchObject({ amount: 1 }); // other slot untouched
    expect(store!.getDay("me", iso()).meals.dinner.entries).toHaveLength(0); // partner untouched
  });

  it("grams / subjective / coffee keep the full editor instead of a stepper", async () => {
    renderEditor();
    act(() => store!.addEntry("dinner", measured("אורז", "גרם", 150)));
    act(() =>
      store!.addEntry("dinner", {
        foodId: "f_salad",
        foodName: "סלט",
        mode: "subjective",
        subjective: "הרבה",
      }),
    );
    act(() =>
      store!.addEntry("dinner", {
        ...measured("קפה", "כוס"),
        coffee: { type: "אמריקנו", milk: "ללא חלב" },
      }),
    );
    expect(within(row("אורז")).queryByTestId("qty-plus")).toBeNull();
    expect(within(row("אורז")).getByText("150 גרם")).toBeInTheDocument();
    expect(within(row("סלט")).queryByTestId("qty-plus")).toBeNull();
    expect(within(row("סלט")).getByText("הרבה")).toBeInTheDocument();
    // Coffee in cups IS a count unit: it steps, and the summary stays visible.
    expect(within(row("קפה")).getByTestId("qty-plus")).toBeInTheDocument();
    expect(within(row("קפה")).getByText(/אמריקנו · ללא חלב/)).toBeInTheDocument();
    // Every row still has the full editor.
    expect(screen.getAllByRole("button", { name: /^עריכה: / })).toHaveLength(3);
  });

  it("keeps fractions: 1,5 כוסות → 2,5 → 1,5, and refuses below 1", async () => {
    const user = userEvent.setup();
    renderEditor();
    act(() => store!.addEntry("dinner", measured("תה", "כוס", 1.5)));
    const tea = row("תה");
    expect(tea).toHaveAttribute("data-quantity", "1,5 כוסות");
    await user.click(within(tea).getByRole("button", { name: "עוד תה" }));
    expect(tea).toHaveAttribute("data-quantity", "2,5 כוסות");
    await user.click(within(tea).getByRole("button", { name: "פחות תה" }));
    expect(tea).toHaveAttribute("data-quantity", "1,5 כוסות");
    expect(within(tea).getByRole("button", { name: "פחות תה" })).toBeDisabled(); // 0.5 < 1
  });

  it("rapid taps end in the right state and survive a reload (demo persistence)", async () => {
    const user = userEvent.setup();
    renderEditor();
    act(() => store!.addEntry("dinner", measured("ביצה קשה", "יחידה")));
    const plus = () => within(row("ביצה קשה")).getByRole("button", { name: "עוד ביצה קשה" });
    await user.click(plus());
    await user.click(plus());
    await user.click(plus());
    await user.click(plus());
    expect(row("ביצה קשה")).toHaveAttribute("data-quantity", "5 יחידות");
    expect(store!.getDay("me", iso()).meals.dinner.entries).toHaveLength(1);

    // "Reload": a fresh provider reads the persisted demo state.
    cleanup();
    store = null;
    renderEditor();
    expect(store!.getDay("me", iso()).meals.dinner.entries[0]).toMatchObject({ amount: 5 });
    expect(row("ביצה קשה")).toHaveAttribute("data-quantity", "5 יחידות");
  });

  it("the just-added row is highlighted and the toast names the usual quantity", async () => {
    const user = userEvent.setup();
    renderEditor();
    // Typed results require quantity confirmation; the trusted recent chip remains one-tap.
    await user.type(screen.getByRole("textbox", { name: "חיפוש מאכל" }), "תפוח");
    await user.click((await screen.findAllByTestId("search-result"))[0]);
    await user.click(screen.getByRole("button", { name: "הוספת המאכל" }));
    expect(screen.getAllByTestId("meal-entry")[0]).toHaveAttribute("data-quantity", "1 יחידה");
    await user.click(screen.getByRole("button", { name: "תפוח, הוספה של 1 יחידה" }));
    const rows = screen.getAllByTestId("meal-entry");
    expect(rows).toHaveLength(2);
    expect(rows[1].className).toMatch(/border-primary/);
    expect(rows[0].className).not.toMatch(/border-primary/);
    // One tap fixes the usual quantity right there.
    await user.click(within(rows[1]).getByRole("button", { name: "עוד תפוח" }));
    expect(rows[1]).toHaveAttribute("data-quantity", "2 יחידות");
  });
});
