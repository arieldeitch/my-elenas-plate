import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { toISODate } from "@/lib/format";
import { WeightBanner } from "./WeightBanner";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

/**
 * The store no longer ships any seeded weigh-ins (the demo seed was removed so a
 * mock row can never reach a real account), so this test creates its own two
 * measurements through the public store API.
 */
function Harness({ onOpen }: { onOpen: () => void }) {
  const store = useStore();
  return (
    <>
      <button
        onClick={() => {
          store.addWeighIn({ dateISO: "2026-07-18", weightKg: 83.0, bodyFatPct: 24.6 });
          store.addWeighIn({ dateISO: toISODate(new Date()), weightKg: 82.4, bodyFatPct: 24.1 });
        }}
      >
        seed-weigh-ins
      </button>
      <WeightBanner onOpen={onOpen} />
    </>
  );
}

describe("WeightBanner", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the latest weight and a signed, non-color-only delta", async () => {
    const user = userEvent.setup();
    render(<Harness onOpen={vi.fn()} />, { wrapper });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "seed-weigh-ins" }));
    });

    // 83.0 then 82.4 → latest 82.4, delta −0.6.
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
