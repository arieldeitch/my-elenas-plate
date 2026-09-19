import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  it("offers only home, quick add and journal, with a working journal action", () => {
    const onCalendar = vi.fn();
    render(<BottomNav onCalendar={onCalendar} onAdd={vi.fn()} />);
    expect(screen.queryByText("היסטוריה")).not.toBeInTheDocument();
    expect(screen.queryByText("עוד")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "יומן" }));
    expect(onCalendar).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});