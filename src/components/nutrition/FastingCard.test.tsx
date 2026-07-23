import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { FastingCard } from "./FastingCard";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

describe("FastingCard", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the seeded fasting window and its 16h duration (crosses midnight)", () => {
    render(<FastingCard />, { wrapper });
    // אריאל's seed: 20:30 → 12:30 = 16h.
    expect(screen.getByText("20:30")).toBeInTheDocument();
    expect(screen.getByText("12:30")).toBeInTheDocument();
    expect(screen.getByText("16 שעות")).toBeInTheDocument();
  });

  it("opens the editor with time inputs", async () => {
    render(<FastingCard />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "עריכת צום" }));
    expect(screen.getByLabelText("תחילת הצום")).toBeInTheDocument();
    expect(screen.getByLabelText("סיום הצום")).toBeInTheDocument();
  });
});
