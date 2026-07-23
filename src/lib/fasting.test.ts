import { describe, it, expect } from "vitest";
import { calcFastingHours } from "./fasting";

describe("calcFastingHours", () => {
  it("computes a same-day window", () => {
    expect(calcFastingHours("08:00", "12:00")).toBe(4);
  });

  it("handles crossing midnight (16:8 routine)", () => {
    expect(calcFastingHours("20:00", "12:00")).toBe(16);
  });

  it("handles a window ending just after midnight", () => {
    expect(calcFastingHours("23:30", "00:30")).toBe(1);
  });

  it("treats identical start and end as a full 24h fast", () => {
    expect(calcFastingHours("10:00", "10:00")).toBe(24);
  });

  it("rounds to one decimal", () => {
    expect(calcFastingHours("20:00", "12:15")).toBe(16.3);
  });

  it("returns 0 for unparseable input", () => {
    expect(calcFastingHours("", "12:00")).toBe(0);
    expect(calcFastingHours("25:00", "12:00")).toBe(0);
  });
});
