import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { ProfileSwitcher } from "./ProfileSwitcher";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

describe("ProfileSwitcher", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders both profiles as אריאל and אלנה (never 'אני')", () => {
    render(<ProfileSwitcher />, { wrapper });
    expect(screen.getByRole("tab", { name: /אריאל/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /אלנה/ })).toBeInTheDocument();
    expect(screen.queryByText("אני")).toBeNull();
  });

  it("marks the active profile via aria-selected and switches on click", async () => {
    render(<ProfileSwitcher />, { wrapper });
    const ariel = screen.getByRole("tab", { name: /אריאל/ });
    const alena = screen.getByRole("tab", { name: /אלנה/ });
    expect(ariel).toHaveAttribute("aria-selected", "true");

    await userEvent.click(alena);
    expect(alena).toHaveAttribute("aria-selected", "true");
    expect(ariel).toHaveAttribute("aria-selected", "false");
  });
});
