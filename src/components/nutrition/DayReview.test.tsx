import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { DEVICE_PROFILE_KEY } from "@/lib/device-profile";
import { addDays, toISODate } from "@/lib/format";
import type { Unit } from "@/lib/domain";
import { DayReview } from "./DayReview";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);
let store: ReturnType<typeof useStore> | null = null;
function Probe() {
  store = useStore();
  return null;
}
const food = (name: string, unit: Unit = "יחידה") => ({
  foodId: `f_${name}`,
  foodName: name,
  mode: "measured" as const,
  amount: 1,
  unit,
});

function renderReview(person: "me" | "elena" | null = "me") {
  const onClose = vi.fn();
  const onEditSlot = vi.fn();
  const view = render(
    <>
      <DayReview person={person} onClose={onClose} onEditSlot={onEditSlot} />
      <Probe />
    </>,
    { wrapper },
  );
  return { onClose, onEditSlot, view };
}

describe("DayReview (M2-4 — what exactly did we eat today?)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
    store = null;
  });

  it("is closed when no person is requested", () => {
    renderReview(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on the selected date for the active person, all six slots listed, empty ones compact", () => {
    renderReview("me");
    const dialog = screen.getByRole("dialog", { name: "סקירת היום של אריאל" });
    expect(dialog).toHaveAttribute("data-person", "me");
    expect(dialog).toHaveAttribute("data-date", toISODate(new Date()));
    expect(screen.getByText("היום")).toBeInTheDocument();
    expect(screen.getByTestId("day-review-summary")).toHaveTextContent("0/6 ארוחות תועדו");
    const rows = screen.getAllByRole("listitem").filter((li) => li.dataset.status);
    expect(rows).toHaveLength(6);
    expect(rows.every((li) => li.dataset.status === "empty")).toBe(true);
    expect(screen.getAllByText("לא תועד")).toHaveLength(6);
    // "שלי" for me, the partner's name for her.
    expect(screen.getByRole("tab", { name: /שלי/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /אלנה/ })).toHaveAttribute("aria-selected", "false");
  });

  it("groups my foods by slot with quantity and time, distinguishes skipped from empty, keeps a long name on one line", async () => {
    const { onEditSlot } = renderReview("me");
    act(() => store!.addEntry("breakfast", food("קפה", "כוס")));
    act(() => store!.addEntry("breakfast", food("שיבולת שועל", "קערה")));
    act(() =>
      store!.addEntry("lunch", food("שקשוקה עם ביצים ועגבניות ופלפלים קלויים בתנור", "מנה")),
    );
    act(() => store!.setMealSkipped("afternoon_snack", true));

    expect(screen.getByTestId("day-review-summary")).toHaveTextContent(
      "3/6 ארוחות תועדו · 3 פריטים",
    );
    const breakfast = screen.getByTestId("day-review-slot-breakfast");
    expect(breakfast).toHaveAttribute("data-status", "logged");
    expect(within(breakfast).getByText("קפה")).toBeInTheDocument();
    expect(within(breakfast).getByText("1 כוס")).toBeInTheDocument();
    expect(within(breakfast).getByText("שיבולת שועל")).toBeInTheDocument();
    // A real loggedAt yields a HH:mm time; nothing is invented otherwise.
    expect(within(breakfast).getAllByText(/^\d{2}:\d{2}$/)).toHaveLength(2);

    const snack = screen.getByTestId("day-review-slot-afternoon_snack");
    expect(snack).toHaveAttribute("data-status", "skipped");
    expect(within(snack).getByText("לא נאכלה ארוחה")).toBeInTheDocument();
    expect(screen.getByTestId("day-review-slot-dinner")).toHaveAttribute("data-status", "empty");
    expect(
      within(screen.getByTestId("day-review-slot-lunch")).getByText(/שקשוקה עם ביצים/),
    ).toHaveClass("truncate");

    // My slots offer an edit shortcut that names the slot.
    await userEvent.click(screen.getByRole("button", { name: "עריכת ארוחה מרכזית" }));
    expect(onEditSlot).toHaveBeenCalledWith("lunch");
  });

  it("switches to the partner: her foods, no edit buttons, and an explicit switch-to-edit action", async () => {
    const user = userEvent.setup();
    const { onClose, onEditSlot } = renderReview("me");
    act(() => store!.setActiveProfile("elena"));
    act(() => store!.addEntry("dinner", food("סלמון", "מנה")));
    act(() => store!.setActiveProfile("me"));

    await user.click(screen.getByRole("tab", { name: /אלנה/ }));
    const dialog = screen.getByRole("dialog", { name: "סקירת היום של אלנה" });
    expect(dialog).toHaveAttribute("data-person", "elena");
    expect(within(dialog).getByText("סלמון")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^עריכת/ })).toBeNull();
    expect(onEditSlot).not.toHaveBeenCalled();
    // Ownership stays with the reviewer: the active profile did not change by looking.
    expect(store!.activeProfile).toBe("me");

    // Editing her day is a deliberate, separate step.
    await user.click(screen.getByTestId("day-review-switch"));
    expect(store!.activeProfile).toBe("elena");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens directly on the partner when asked, and follows the selected date (past day)", () => {
    renderReview("elena");
    expect(screen.getByRole("dialog", { name: "סקירת היום של אלנה" })).toHaveAttribute(
      "data-person",
      "elena",
    );
    expect(screen.getByText("אלנה עוד לא תיעדה כלום ליום הזה.")).toBeInTheDocument();
    const yesterday = addDays(new Date(), -1);
    act(() => store!.setSelectedDate(yesterday));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-date", toISODate(yesterday));
    expect(screen.queryByText("היום")).toBeNull();
    expect(screen.getByText(/יום (ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/)).toBeInTheDocument();
  });

  it("closing does not touch the selected date or the active person", async () => {
    const { onClose } = renderReview("me");
    const before = { date: toISODate(store!.selectedDate), person: store!.activeProfile };
    await userEvent.click(screen.getByRole("button", { name: "סגירה" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toISODate(store!.selectedDate)).toBe(before.date);
    expect(store!.activeProfile).toBe(before.person);
  });
});
