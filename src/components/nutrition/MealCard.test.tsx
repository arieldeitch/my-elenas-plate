import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MealCard } from "./MealCard";
import type { DailyMeal } from "@/lib/domain";

const meal = (status: DailyMeal["status"]): DailyMeal => ({
  slot: "lunch",
  status,
  entries: [],
});

describe("MealCard", () => {
  it("shows the slot label and a status that is not color-only", () => {
    render(<MealCard meal={meal("logged")} onOpen={() => {}} />);
    expect(screen.getByText("ארוחה מרכזית")).toBeInTheDocument();
    // Status text ("תועד") accompanies the color so status is not color-only.
    expect(screen.getByText("תועד")).toBeInTheDocument();
  });

  it("exposes an accessible name combining label + status", () => {
    render(<MealCard meal={meal("skipped")} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: "ארוחה מרכזית: לא נאכלה" })).toBeInTheDocument();
  });

  it("does not render food details on the tile", () => {
    render(<MealCard meal={meal("empty")} onOpen={() => {}} />);
    expect(screen.getByText("לא תועד")).toBeInTheDocument();
  });

  it("opens the editor on click", async () => {
    const onOpen = vi.fn();
    render(<MealCard meal={meal("empty")} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
