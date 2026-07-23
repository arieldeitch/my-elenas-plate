import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { WorkoutCard } from "./WorkoutCard";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

describe("WorkoutCard", () => {
  beforeEach(() => window.localStorage.clear());

  it("reflects the seeded 'performed' workout and its type", () => {
    render(<WorkoutCard />, { wrapper });
    // אריאל's seed: performed, type הליכה, feeling טוב.
    expect(screen.getByRole("button", { name: "כן" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("סוג האימון")).toBeInTheDocument();
  });

  it("switches to 'not performed' and hides the details", async () => {
    render(<WorkoutCard />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "לא" }));
    expect(screen.getByText("לא בוצע אימון היום.")).toBeInTheDocument();
    expect(screen.queryByText("סוג האימון")).toBeNull();
  });
});
