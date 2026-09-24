/**
 * DEC-038 UI acceptance: the unit picker must OFFER what the engine can score.
 *
 * The engine work is worth nothing if the person cannot reach it. A reference
 * cell that states "1 כף / 15 גרם" scores grams perfectly well, but before this
 * the picker built its chips from resolvableUnits() alone — the DEC-036 list,
 * which only offers grams when the portion itself is a weight. Grams sat behind
 * "יחידות נוספות", so the fix looked done in the unit tests and was invisible
 * in the app.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { DEVICE_PROFILE_KEY } from "@/lib/device-profile";
import { getReferenceIndex } from "@/lib/points-reference";
import type { Food } from "@/lib/domain";
import { QuantitySelector } from "./QuantitySelector";

const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

const index = getReferenceIndex();

/** A row whose portion is a count with an explicit gram equivalence in the cell. */
const explicitSpoonRow = [...index.itemsById.values()].find(
  (i) =>
    i.status === "active" &&
    i.portion?.primary?.family === "count" &&
    i.portion.primary.appUnit === "כף" &&
    i.portion.grams != null,
);

/** A count-only row whose group carries a coherent weight row (דבש). */
const honeySpoonRow = [...index.itemsById.values()].find(
  (i) =>
    i.status === "active" && i.normalizedName === "דבש" && i.portion?.primary?.appUnit === "כף",
);

function foodFor(name: string): Food {
  return {
    id: `f-${name}`,
    name,
    normalizedName: name,
    createdAt: new Date().toISOString(),
  } as Food;
}

function offeredUnits(): string[] {
  return screen.getAllByTestId("unit-option").map((b) => b.textContent?.trim() ?? "");
}

describe("DEC-038 · the unit picker offers what the engine can resolve", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(DEVICE_PROFILE_KEY, "me");
  });

  // This one already held before DEC-038 — resolvableUnits() offers grams once
  // the cell states them — and it is pinned because it is the task's headline
  // example and must not regress while the list around it changes.
  it("offers grams for a '1 כף / 15 גרם' row without asking for a bridge first", () => {
    expect(explicitSpoonRow).toBeDefined();
    render(
      <QuantitySelector
        food={foodFor(explicitSpoonRow!.normalizedName)}
        referenceItem={explicitSpoonRow}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
      { wrapper },
    );
    const units = offeredUnits();
    expect(units).toContain("כף");
    expect(units).toContain("גרם");
    // ...and it is a first-class choice, not something hidden behind the
    // "more units" escape hatch.
    expect(screen.getByText("יחידות נוספות")).toBeInTheDocument();
  });

  // This one is the actual gap: a count-only portion. resolvableUnits() returns
  // no weight unit at all for it, so before the picker read convertibleUnits()
  // the engine could score 30 גרם of דבש that the person could not ask for.
  it("offers grams when the same reference group carries coherent weight evidence", () => {
    expect(honeySpoonRow).toBeDefined();
    render(
      <QuantitySelector
        food={foodFor("דבש")}
        referenceItem={honeySpoonRow}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
      { wrapper },
    );
    expect(offeredUnits()).toContain("גרם");
  });

  it("scores a weighed amount of a spoon-based row instead of refusing it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <QuantitySelector
        food={foodFor("דבש")}
        referenceItem={honeySpoonRow}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
      { wrapper },
    );
    const grams = screen.getAllByTestId("unit-option").find((b) => b.textContent?.trim() === "גרם");
    expect(grams).toBeDefined();
    await user.click(grams!);
    const amount = screen.getByRole("spinbutton", { name: "כמות" });
    await user.clear(amount);
    await user.type(amount, "30");
    // The preview must not say the quantity is refused.
    expect(screen.queryByText(/לא ניתן/)).not.toBeInTheDocument();
  });
});
