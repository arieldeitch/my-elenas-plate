import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { DEVICE_PROFILE_KEY } from "@/lib/device-profile";
import { PartnerGlance } from "./PartnerGlance";
import { ProfileSwitcher } from "./ProfileSwitcher";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

// Test-only handle on the store so a case can log as one profile and then
// look at the glance card from the other side.
let store: ReturnType<typeof useStore> | null = null;
function Probe() {
  store = useStore();
  return null;
}

const apple = {
  foodId: "f_apple",
  foodName: "תפוח",
  mode: "measured" as const,
  amount: 1,
  unit: "יחידה" as const,
};

describe("PartnerGlance (M2 — partner's day at a glance)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
    store = null;
  });

  it("shows the partner (אלנה) with an empty day and six empty slot dots — no food details", () => {
    render(<PartnerGlance />, { wrapper });
    const card = screen.getByTestId("partner-glance");
    expect(card).toHaveAttribute("data-partner", "elena");
    expect(card).toHaveTextContent("אלנה");
    expect(card).toHaveTextContent("עוד לא תיעדה היום");
    expect(card.querySelectorAll("[data-slot]")).toHaveLength(6);
    expect(card.querySelectorAll("[data-status='empty']")).toHaveLength(6);
  });

  it("reflects the partner's slot statuses and count after she logs, without switching", async () => {
    render(
      <>
        <ProfileSwitcher />
        <PartnerGlance />
        <Probe />
      </>,
      { wrapper },
    );
    // Log as Elena: one meal documented, one skipped.
    act(() => store!.setActiveProfile("elena"));
    act(() => store!.addEntry("lunch", apple));
    act(() => store!.setMealSkipped("late", true));
    // Back to Ariel's view — the card now describes Elena's day.
    act(() => store!.setActiveProfile("me"));

    const card = screen.getByTestId("partner-glance");
    expect(card).toHaveAttribute("data-partner", "elena");
    expect(card).toHaveTextContent("2 מתוך 6 ארוחות תועדו");
    expect(card.querySelector("[data-slot='lunch']")).toHaveAttribute("data-status", "logged");
    expect(card.querySelector("[data-slot='late']")).toHaveAttribute("data-status", "skipped");
    expect(card.querySelectorAll("[data-status='empty']")).toHaveLength(4);
    // Never the food name on the home screen.
    expect(card).not.toHaveTextContent("תפוח");
  });

  it("tapping the card switches to the partner, and the card then shows the other side", async () => {
    render(
      <>
        <ProfileSwitcher />
        <PartnerGlance />
      </>,
      { wrapper },
    );
    await userEvent.click(screen.getByTestId("partner-glance"));
    expect(screen.getByRole("tab", { name: /אלנה/ })).toHaveAttribute("aria-selected", "true");
    const card = screen.getByTestId("partner-glance");
    expect(card).toHaveAttribute("data-partner", "me");
    expect(card).toHaveTextContent("אריאל");
    expect(card).toHaveTextContent("עוד לא תיעד היום");
  });
});
