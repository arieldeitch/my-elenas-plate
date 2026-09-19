import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { FastingCard } from "./FastingCard";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

/**
 * The store ships no seeded fasting window any more (the demo seed was removed
 * so mock rows can never reach a real account), so the test documents its own.
 */
function Harness() {
  const store = useStore();
  return (
    <>
      <button onClick={() => store.setFasting({ start: "20:30", end: "12:30" })}>
        set-fasting
      </button>
      <FastingCard />
    </>
  );
}

describe("FastingCard", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts with no documented fasting window", () => {
    render(<FastingCard />, { wrapper });
    expect(screen.queryByText("20:30")).not.toBeInTheDocument();
    expect(screen.queryByText("16 שעות")).not.toBeInTheDocument();
  });

  it("shows a documented window and its 16h duration (crosses midnight)", async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "set-fasting" }));
    });

    // 20:30 → 12:30 = 16h across midnight.
    expect(screen.getByText("20:30")).toBeInTheDocument();
    expect(screen.getByText("12:30")).toBeInTheDocument();
    expect(screen.getByText("16 שעות")).toBeInTheDocument();
  });

  it("opens the editor with time inputs", async () => {
    const user = userEvent.setup();
    render(<Harness />, { wrapper });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "set-fasting" }));
    });

    await user.click(screen.getByRole("button", { name: "עריכת צום" }));
    expect(screen.getByLabelText("תחילת הצום")).toBeInTheDocument();
    expect(screen.getByLabelText("סיום הצום")).toBeInTheDocument();
  });
});
