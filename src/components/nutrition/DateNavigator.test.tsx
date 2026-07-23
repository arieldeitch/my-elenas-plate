import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { DateNavigator } from "./DateNavigator";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

describe("DateNavigator", () => {
  beforeEach(() => window.localStorage.clear());

  it("labels the current day and moves to the previous/next day", async () => {
    const user = userEvent.setup();
    render(<DateNavigator onOpenCalendar={vi.fn()} />, { wrapper });
    expect(screen.getByText("היום")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "יום קודם" }));
    expect(screen.getByText("תאריך")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "יום הבא" }));
    expect(screen.getByText("היום")).toBeInTheDocument();
  });

  it("opens the calendar from the calendar button", async () => {
    const onOpenCalendar = vi.fn();
    render(<DateNavigator onOpenCalendar={onOpenCalendar} />, { wrapper });
    await userEvent.click(screen.getByRole("button", { name: "פתיחת לוח שנה" }));
    expect(onOpenCalendar).toHaveBeenCalledTimes(1);
  });
});
