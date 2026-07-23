/**
 * Weight/body-composition math. Rounding happens only in display; these return
 * full-precision values so callers control formatting.
 */
import type { WeighIn } from "./domain";

/** Fat mass in kg = weight × bodyFat% / 100. Null if inputs are out of range. */
export function calcFatMass(weightKg: number, bodyFatPct: number | undefined): number | null {
  if (!isFinite(weightKg) || weightKg <= 0) return null;
  if (bodyFatPct == null || !isFinite(bodyFatPct) || bodyFatPct <= 0 || bodyFatPct >= 100) {
    return null;
  }
  return (weightKg * bodyFatPct) / 100;
}

/** Signed delta (current − previous) in kg, or null when there is no previous. */
export function calcWeightDelta(current: number, previous: number | undefined): number | null {
  if (previous == null || !isFinite(previous) || !isFinite(current)) return null;
  return current - previous;
}

/**
 * Returns the latest and previous weigh-ins from a list ordered ascending by
 * date. Central helper so the banner and history read the same "latest" record.
 */
export function latestAndPrevious(weighIns: WeighIn[]): {
  latest?: WeighIn;
  previous?: WeighIn;
} {
  if (weighIns.length === 0) return {};
  return {
    latest: weighIns[weighIns.length - 1],
    previous: weighIns.length >= 2 ? weighIns[weighIns.length - 2] : undefined,
  };
}
