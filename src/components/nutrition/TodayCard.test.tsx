import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { DEVICE_PROFILE_KEY } from "@/lib/device-profile";
import { TodayCard } from "./TodayCard";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);
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

describe("TodayCard (M2 home — ME)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
    store = null;
  });

  it("names the person and the day, and moves to the previous/next day", async () => {
    const user = userEvent.setup();
    render(<TodayCard onOpenCalendar={vi.fn()} />, { wrapper });
    const card = screen.getByTestId("today-card");
    expect(card).toHaveAttribute("data-owner", "me");
    expect(card).toHaveTextContent("אריאל");
    expect(card).toHaveTextContent("היום");
    expect(screen.getByTestId("today-latest")).toHaveTextContent("עוד לא תועד היום");

    await user.click(screen.getByRole("button", { name: "יום קודם" }));
    expect(card).toHaveTextContent("תאריך");
    await user.click(screen.getByRole("button", { name: "יום הבא" }));
    expect(card).toHaveTextContent("היום");
  });

  it("opens the calendar from the calendar button", async () => {
    const onOpenCalendar = vi.fn();
    render(<TodayCard onOpenCalendar={onOpenCalendar} />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "פתיחת לוח שנה" }));
    expect(onOpenCalendar).toHaveBeenCalledTimes(1);
  });

  it("shows progress and the latest logged food for the active person only", () => {
    render(
      <>
        <TodayCard onOpenCalendar={vi.fn()} />
        <Probe />
      </>,
      { wrapper },
    );
    act(() => store!.addEntry("breakfast", { ...apple, foodName: "ביצה" }));
    act(() => store!.addEntry("lunch", apple));
    expect(screen.getByTestId("today-count")).toHaveTextContent("2/6");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByTestId("today-latest")).toHaveTextContent(/לאחרונה: תפוח · ארוחה מרכזית/);

    // Switching to the partner shows HER (empty) day, not mine.
    act(() => store!.setActiveProfile("elena"));
    const card = screen.getByTestId("today-card");
    expect(card).toHaveAttribute("data-owner", "elena");
    expect(card).toHaveTextContent("אלנה");
    expect(screen.getByTestId("today-count")).toHaveTextContent("0/6");
    expect(screen.getByTestId("today-latest")).toHaveTextContent("עוד לא תועד היום");
  });
});
