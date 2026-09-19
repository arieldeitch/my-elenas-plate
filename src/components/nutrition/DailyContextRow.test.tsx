import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { DEVICE_PROFILE_KEY } from "@/lib/device-profile";
import { toISODate } from "@/lib/format";
import { DailyContextRow } from "./DailyContextRow";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);
let store: ReturnType<typeof useStore> | null = null;
function Probe() {
  store = useStore();
  return null;
}
function renderRow(onOpenWeight = vi.fn()) {
  render(
    <>
      <DailyContextRow onOpenWeight={onOpenWeight} />
      <Probe />
    </>,
    { wrapper },
  );
  return onOpenWeight;
}

describe("DailyContextRow (weight · workout · fasting · steps)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
    store = null;
  });

  it("states the four daily context tiles clearly on an empty day, with no panel open", () => {
    renderRow();
    expect(screen.getByTestId("context-weight")).toHaveAttribute("data-value", "—");
    expect(screen.getByTestId("context-weight")).toHaveTextContent("הוספת שקילה");
    expect(screen.getByTestId("context-workout")).toHaveAttribute("data-value", "לא תועד");
    expect(screen.getByTestId("context-fasting")).toHaveAttribute("data-value", "לא תועד");
    expect(screen.getByTestId("context-steps")).toHaveAttribute("data-value", "לא דווח");
    expect(screen.getByTestId("context-steps")).toHaveTextContent("יעד 10,000");
    expect(screen.queryByTestId("daily-context-panel")).toBeNull();
    // Accessible names carry the state, not just an icon.
    expect(screen.getByRole("button", { name: /שקילה: לא תועדה שקילה/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /צום: לא תועד\. הוספת שעות/ })).toBeInTheDocument();
  });

  it("weight: shows the latest value, when it was taken and a signed delta; tap opens the form", async () => {
    const user = userEvent.setup();
    const onOpenWeight = renderRow();
    act(() => store!.addWeighIn({ dateISO: "2026-07-18", weightKg: 83.0 }));
    act(() => store!.addWeighIn({ dateISO: toISODate(new Date()), weightKg: 82.4 }));
    const cell = screen.getByTestId("context-weight");
    expect(cell).toHaveAttribute("data-value", "82.4 ק״ג");
    expect(cell).toHaveTextContent("היום");
    expect(cell).toHaveTextContent("−0.6"); // sign + number, never colour only
    await user.click(screen.getByRole("button", { name: /פתיחת טופס שקילה/ }));
    expect(onOpenWeight).toHaveBeenCalledTimes(1);
  });

  it("workout: unfolds the editor on tap; 'כן' reveals the details; 'לא' is one tap", async () => {
    const user = userEvent.setup();
    renderRow();
    const cell = screen.getByTestId("context-workout");
    expect(cell).toHaveAttribute("aria-expanded", "false");
    await user.click(cell);
    expect(cell).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByTestId("daily-context-panel");
    expect(within(panel).getByRole("button", { name: "כן" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(within(panel).getByRole("button", { name: "כן" }));
    expect(within(panel).getByText("סוג האימון")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "ריצה" }));
    expect(cell).toHaveAttribute("data-value", "ריצה");
    expect(cell).toHaveTextContent("טוב"); // default feeling

    await user.click(within(panel).getByRole("button", { name: "לא" }));
    expect(within(panel).getByText("לא בוצע אימון היום.")).toBeInTheDocument();
    expect(cell).toHaveAttribute("data-value", "לא בוצע");
    // Fold it away again from the cell itself.
    await user.click(cell);
    expect(screen.queryByTestId("daily-context-panel")).toBeNull();
  });

  it("fasting: editor with time inputs, save shows the 16h window (crosses midnight), clear resets", async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole("button", { name: /הוספת שעות/ }));
    const start = screen.getByLabelText("תחילת הצום");
    const end = screen.getByLabelText("סיום הצום");
    await user.clear(start);
    await user.type(start, "20:30");
    await user.clear(end);
    await user.type(end, "12:30");
    expect(screen.getByText("משך הצום: 16 שעות")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "שמירה" }));

    // Panel folds; the cell now carries the window.
    expect(screen.queryByTestId("daily-context-panel")).toBeNull();
    const cell = screen.getByTestId("context-fasting");
    expect(cell).toHaveAttribute("data-value", "16 שעות");
    expect(cell).toHaveTextContent("20:30–12:30");
    expect(screen.getByRole("button", { name: /עריכת צום/ })).toBe(cell);

    await user.click(cell);
    await user.click(screen.getByRole("button", { name: "ניקוי" }));
    expect(cell).toHaveAttribute("data-value", "לא תועד");
  });

  it("steps: exact number and quick 'ביצעתי' are distinct, fast paths", async () => {
    const user = userEvent.setup();
    renderRow();
    const cell = screen.getByTestId("context-steps");

    await user.click(cell);
    const count = screen.getByLabelText("מספר צעדים");
    await user.type(count, "8734");
    await user.click(screen.getByRole("button", { name: "שמירה" }));
    expect(cell).toHaveAttribute("data-value", "8,734");

    await user.click(cell);
    await user.click(screen.getByRole("button", { name: "ביצעתי את יעד הצעדים" }));
    expect(cell).toHaveAttribute("data-value", "בוצע");
  });

  it("steps use the selected date and stay isolated per person", () => {
    renderRow();
    const today = toISODate(store!.selectedDate);
    act(() => store!.setSteps({ goalSteps: 10_000, steps: 9_000, completed: false }));
    expect(store!.getDay("me", today).steps?.steps).toBe(9_000);

    const yesterday = new Date(store!.selectedDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = toISODate(yesterday);
    act(() => store!.setSelectedDate(yesterday));
    act(() => store!.setSteps({ goalSteps: 12_000, completed: true }));
    expect(store!.getDay("me", yesterdayISO).steps).toEqual({
      goalSteps: 12_000,
      steps: undefined,
      completed: true,
    });
    expect(store!.getDay("me", today).steps?.steps).toBe(9_000);

    act(() => store!.setActiveProfile("elena"));
    expect(store!.getDay("elena", yesterdayISO).steps?.completed).toBe(false);
  });

  it("only one panel at a time, and panels fold when the person changes", async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByTestId("context-workout"));
    await user.click(screen.getByTestId("context-fasting"));
    expect(screen.getByTestId("fasting-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("workout-editor")).toBeNull();
    act(() => store!.setActiveProfile("elena"));
    expect(screen.queryByTestId("daily-context-panel")).toBeNull();
  });

  it("is per person: Elena's fasting does not show on Ariel's row", () => {
    renderRow();
    act(() => store!.setActiveProfile("elena"));
    act(() => store!.setFasting({ start: "20:00", end: "12:00" }));
    expect(screen.getByTestId("context-fasting")).toHaveAttribute("data-value", "16 שעות");
    act(() => store!.setActiveProfile("me"));
    expect(screen.getByTestId("context-fasting")).toHaveAttribute("data-value", "לא תועד");
  });
});
