import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  it("shows only real actions: Home, Quick Add and Journal", () => {
    render(<BottomNav />);
    expect(screen.getByRole("button", { name: "בית" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הוספה מהירה" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "יומן" })).toBeInTheDocument();
    expect(screen.queryByText("היסטוריה")).toBeNull();
    expect(screen.queryByText("עוד")).toBeNull();
  });

  it("opens the journal through the calendar callback", async () => {
    const onCalendar = vi.fn();
    render(<BottomNav onCalendar={onCalendar} />);
    await userEvent.click(screen.getByRole("button", { name: "יומן" }));
    expect(onCalendar).toHaveBeenCalledTimes(1);
  });
});
