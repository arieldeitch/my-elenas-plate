import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoreProvider } from "@/lib/store";
import { DailyContext } from "./DailyContext";

describe("DailyContext", () => {
  it("renders four equal-purpose context tiles and exposes both step modes", () => {
    const { container } = render(
      <StoreProvider>
        <DailyContext onOpenWeight={() => {}} />
      </StoreProvider>,
    );
    for (const label of ["שקילה", "אימון", "צום", "צעדים"])
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelectorAll(".context-tile")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /צעדים/ }));
    expect(screen.getByLabelText("מספר מדויק")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ביצעתי/ })).toBeInTheDocument();
  });

  it("saves an exact step report through the editor", () => {
    render(
      <StoreProvider>
        <DailyContext onOpenWeight={() => {}} />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /צעדים/ }));
    fireEvent.change(screen.getByLabelText("מספר מדויק"), { target: { value: "8734" } });
    fireEvent.click(screen.getByRole("button", { name: "שמירת מספר" }));
    expect(screen.getByText("8,734")).toBeInTheDocument();
  });
});
