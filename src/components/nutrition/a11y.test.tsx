import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { MealCard } from "./MealCard";
import { CoffeeSelector } from "./CoffeeSelector";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { TodayCard } from "./TodayCard";
import { PartnerGlance } from "./PartnerGlance";
import { DailyContextRow } from "./DailyContextRow";
import type { DailyMeal } from "@/lib/domain";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);
const meal: DailyMeal = { slot: "lunch", status: "logged", entries: [] };

// Landmark/region rules don't apply to isolated component fragments.
const opts = { rules: { region: { enabled: false } } } as const;

describe("accessibility (axe)", () => {
  beforeEach(() => window.localStorage.clear());

  it("MealCard has no violations", async () => {
    const { container } = render(<MealCard meal={meal} onOpen={() => {}} />);
    expect(await axe(container, opts)).toHaveNoViolations();
  });

  it("CoffeeSelector has no violations", async () => {
    const { container } = render(<CoffeeSelector onSubmit={vi.fn()} onCancel={() => {}} />);
    expect(await axe(container, opts)).toHaveNoViolations();
  });

  it("ProfileSwitcher has no violations", async () => {
    const { container } = render(<ProfileSwitcher />, { wrapper });
    expect(await axe(container, opts)).toHaveNoViolations();
  });

  it("TodayCard + PartnerGlance (M2 home) have no violations", async () => {
    const { container } = render(
      <>
        <TodayCard onOpenCalendar={vi.fn()} />
        <PartnerGlance />
      </>,
      { wrapper },
    );
    expect(await axe(container, opts)).toHaveNoViolations();
  });

  it("DailyContextRow has no violations", async () => {
    const { container } = render(<DailyContextRow onOpenWeight={vi.fn()} />, { wrapper });
    expect(await axe(container, opts)).toHaveNoViolations();
  });
});
