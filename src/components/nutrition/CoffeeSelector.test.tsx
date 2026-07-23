import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoffeeSelector } from "./CoffeeSelector";
import type { FoodEntry } from "@/lib/domain";

describe("CoffeeSelector", () => {
  it("adds a coffee with sensible defaults in one tap", async () => {
    const onSubmit = vi.fn();
    render(<CoffeeSelector onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "הוספת הקפה" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const entry = onSubmit.mock.calls[0][0] as Omit<FoodEntry, "id">;
    expect(entry.mode).toBe("measured");
    expect(entry.coffee).toEqual({ type: "אמריקנו", milk: "ללא חלב" });
    expect(entry.amount).toBe(1);
    expect(entry.unit).toBe("כוס");
  });

  it("reveals milk types only when milk is selected", async () => {
    render(<CoffeeSelector onSubmit={vi.fn()} onCancel={() => {}} />);
    expect(screen.queryByRole("button", { name: "שקדים" })).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "עם חלב" }));
    expect(screen.getByRole("button", { name: "שקדים" })).toBeInTheDocument();
  });

  it("clears a stale milk type when switching back to 'ללא חלב'", async () => {
    const onSubmit = vi.fn();
    render(<CoffeeSelector onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.click(screen.getByRole("tab", { name: "עם חלב" }));
    await userEvent.click(screen.getByRole("button", { name: "סויה" }));
    await userEvent.click(screen.getByRole("tab", { name: "ללא חלב" }));
    await userEvent.click(screen.getByRole("button", { name: "הוספת הקפה" }));

    const entry = onSubmit.mock.calls[0][0] as Omit<FoodEntry, "id">;
    expect(entry.coffee).toEqual({ type: "אמריקנו", milk: "ללא חלב" });
    expect(entry.coffee?.milkType).toBeUndefined();
  });

  it("prefills when editing an existing coffee entry", () => {
    const initial: FoodEntry = {
      id: "e1",
      foodId: "f_coffee",
      foodName: "קפה",
      mode: "measured",
      amount: 1,
      unit: "ספל",
      coffee: { type: "לאטה", milk: "עם חלב", milkType: "שקדים" },
    };
    render(
      <CoffeeSelector
        initial={initial}
        submitLabel="עדכון"
        onSubmit={vi.fn()}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "לאטה" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "שקדים" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "עדכון" })).toBeInTheDocument();
  });
});
