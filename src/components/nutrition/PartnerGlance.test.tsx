import { describe, it, expect, beforeEach, vi } from "vitest";
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
    expect(card).toHaveAccessibleName(/2 מתוך 6 ארוחות תועדו/);
    // The visible line answers "what did she eat last?" (name + slot, no quantity).
    expect(card).toHaveTextContent(/לאחרונה: תפוח עץ · ארוחה מרכזית/);
    expect(card.querySelector("[data-slot='lunch']")).toHaveAttribute("data-status", "logged");
    expect(card.querySelector("[data-slot='late']")).toHaveAttribute("data-status", "skipped");
    expect(card.querySelectorAll("[data-status='empty']")).toHaveLength(4);
    // No quantities or lists on the home screen — one line, no details.
    expect(card).not.toHaveTextContent(/יחידה/);
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

describe("PartnerGlance — fasting / workout only when the data exists", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
    store = null;
  });

  it("shows nothing extra for an empty day, then the partner's fasting window and workout", () => {
    render(
      <>
        <PartnerGlance />
        <Probe />
      </>,
      { wrapper },
    );
    expect(screen.queryByTestId("partner-fasting")).toBeNull();
    expect(screen.queryByTestId("partner-workout")).toBeNull();

    act(() => store!.setActiveProfile("elena"));
    act(() => store!.setFasting({ start: "20:00", end: "12:00" }));
    act(() => store!.setWorkout({ performed: true, type: "ריצה" }));
    act(() => store!.setActiveProfile("me"));

    expect(screen.getByTestId("partner-fasting")).toHaveTextContent("20:00–12:00");
    expect(screen.getByTestId("partner-workout")).toBeInTheDocument();
    // My own card is untouched by her fasting/workout.
    act(() => store!.setActiveProfile("elena"));
    expect(screen.queryByTestId("partner-fasting")).toBeNull();
  });
});

describe("PartnerGlance — M2-4 entry point", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
  });

  it("with onOpen, a tap opens the partner's Day Review instead of switching profiles", async () => {
    const onOpen = vi.fn();
    render(
      <>
        <ProfileSwitcher />
        <PartnerGlance onOpen={onOpen} />
      </>,
      { wrapper },
    );
    const card = screen.getByRole("button", { name: /סקירת היום של אלנה/ });
    await userEvent.click(card);
    expect(onOpen).toHaveBeenCalledWith("elena");
    // Looking is not switching.
    expect(screen.getByRole("tab", { name: /אריאל/ })).toHaveAttribute("aria-selected", "true");
  });
});
