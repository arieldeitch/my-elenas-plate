import { describe, it, expect } from "vitest";
import { calcFatMass, calcWeightDelta, latestAndPrevious } from "./weight";
import type { WeighIn } from "./domain";

describe("calcFatMass", () => {
  it("computes weight × bodyFat% / 100", () => {
    expect(calcFatMass(80, 25)).toBe(20);
  });

  it("returns null without a body-fat value", () => {
    expect(calcFatMass(80, undefined)).toBeNull();
  });

  it("rejects out-of-range body-fat", () => {
    expect(calcFatMass(80, 0)).toBeNull();
    expect(calcFatMass(80, 100)).toBeNull();
    expect(calcFatMass(80, -5)).toBeNull();
  });

  it("rejects non-positive weight", () => {
    expect(calcFatMass(0, 25)).toBeNull();
  });
});

describe("calcWeightDelta", () => {
  it("returns signed difference", () => {
    expect(calcWeightDelta(82.4, 83)).toBeCloseTo(-0.6, 5);
    expect(calcWeightDelta(83, 82)).toBeCloseTo(1, 5);
  });

  it("returns null without a previous value", () => {
    expect(calcWeightDelta(82, undefined)).toBeNull();
  });
});

describe("latestAndPrevious", () => {
  const w = (dateISO: string, weightKg: number): WeighIn => ({ id: dateISO, dateISO, weightKg });

  it("returns empty object for no weigh-ins", () => {
    expect(latestAndPrevious([])).toEqual({});
  });

  it("returns latest without previous for a single weigh-in", () => {
    const res = latestAndPrevious([w("2026-07-01", 80)]);
    expect(res.latest?.weightKg).toBe(80);
    expect(res.previous).toBeUndefined();
  });

  it("returns the last two of an ascending list", () => {
    const res = latestAndPrevious([w("2026-07-01", 83), w("2026-07-08", 82.4)]);
    expect(res.latest?.weightKg).toBe(82.4);
    expect(res.previous?.weightKg).toBe(83);
  });
});
