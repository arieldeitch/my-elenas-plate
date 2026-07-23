/**
 * Quantity validation shared by the quantity selector and coffee editor.
 * Subjective amounts are always stored as entered and never converted to a
 * number — the two modes are validated independently.
 */
import type { QuantityMode, SubjectiveAmount, Unit } from "./domain";

export interface MeasuredInput {
  amount: number;
  unit?: Unit;
}

export type MeasuredError = "amount" | "unit";

/** Validates a measured quantity: positive amount and a chosen unit. */
export function validateMeasured(input: MeasuredInput): MeasuredError[] {
  const errors: MeasuredError[] = [];
  if (!isFinite(input.amount) || input.amount <= 0) errors.push("amount");
  if (!input.unit) errors.push("unit");
  return errors;
}

/** Parses a user-entered amount ("1,5" or "1.5") to a number, or NaN. */
export function parseAmount(raw: string): number {
  return Number(raw.replace(",", "."));
}

const SUBJECTIVES: SubjectiveAmount[] = ["מעט", "במידה", "הרבה", "מוגזם"];

export function isSubjectiveAmount(v: string): v is SubjectiveAmount {
  return (SUBJECTIVES as string[]).includes(v);
}

export function validateMode(mode: QuantityMode, value: MeasuredInput | SubjectiveAmount): boolean {
  if (mode === "measured") {
    return validateMeasured(value as MeasuredInput).length === 0;
  }
  return isSubjectiveAmount(value as string);
}
