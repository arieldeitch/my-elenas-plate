import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { WeightBanner } from "./WeightBanner";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

describe("WeightBanner", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the latest weight and a signed, non-color-only delta", () => {
    render(<WeightBanner onOpen={vi.fn()} />, { wrapper });
    // אריאל's seed: 83.0 then 82.4 → latest 82.4, delta −0.6.
    expect(screen.getByText(/82\.4 ק״ג/)).toBeInTheDocument();
    // Delta carries a sign + number, not just a color.
    expect(screen.getByText(/0\.6 ק״ג מהשקילה הקודמת/)).toBeInTheDocument();
  });

  it("opens the weigh-in form when pressed", async () => {
    const onOpen = vi.fn();
    render(<WeightBanner onOpen={onOpen} />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "פתיחת טופס שקילה" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
