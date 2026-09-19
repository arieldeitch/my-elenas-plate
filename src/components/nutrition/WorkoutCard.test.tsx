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

  it("starts undocumented, with neither answer pre-selected", () => {
    render(<WorkoutCard />, { wrapper });
    expect(screen.getByRole("button", { name: "כן" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "לא" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reveals the details once 'performed' is chosen", async () => {
    render(<WorkoutCard />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "כן" }));
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
