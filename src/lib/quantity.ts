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

// --- M2-5: one-tap quantity adjustment ---------------------------------------

/**
 * Units that are counted in whole pieces/portions. Only these support the
 * inline − / + stepper (step 1, never below 1). Weight/volume units (גרם,
 * ק״ג, מ״ל, ליטר) have no obvious universal step and keep the full editor;
 * subjective amounts and non-measured entries are never stepped.
 */
export const COUNT_UNITS: Unit[] = [
  "יחידה",
  "חצי יחידה",
  "כף",
  "כפית",
  "כוס",
  "ספל",
  "פרוסה",
  "קערה",
  "מנה",
];

export const STEP_MIN = 1;

interface Steppable {
  mode: QuantityMode;
  amount?: number;
  unit?: Unit;
}

/** True when the entry's quantity can be adjusted with the inline stepper. */
export function canStep(entry: Steppable): boolean {
  return (
    entry.mode === "measured" &&
    !!entry.unit &&
    COUNT_UNITS.includes(entry.unit) &&
    typeof entry.amount === "number" &&
    isFinite(entry.amount) &&
    entry.amount > 0
  );
}

/**
 * The amount after one tap, or null when the tap is not allowed. Fractional
 * amounts keep their fraction (1.5 → 2.5); decrementing never goes below
 * STEP_MIN, so 1 − 1 is refused (deleting stays a separate, deliberate act).
 */
export function stepAmount(entry: Steppable, direction: 1 | -1): number | null {
  if (!canStep(entry)) return null;
  const next = Math.round(((entry.amount as number) + direction) * 100) / 100;
  if (next < STEP_MIN) return null;
  return next;
}

/** Hebrew plural of a count unit for amounts other than exactly 1. */
const UNIT_PLURAL: Partial<Record<Unit, string>> = {
  יחידה: "יחידות",
  "חצי יחידה": "חצאי יחידה",
  כף: "כפות",
  כפית: "כפיות",
  כוס: "כוסות",
  ספל: "ספלים",
  פרוסה: "פרוסות",
  קערה: "קערות",
  מנה: "מנות",
};

/** "2 יחידות", "1 קערה", "150 גרם", or the subjective word. */
export function formatQuantity(entry: {
  mode: QuantityMode;
  amount?: number;
  unit?: Unit;
  subjective?: SubjectiveAmount;
}): string {
  if (entry.mode !== "measured") return entry.subjective ?? "";
  const amount = entry.amount ?? 0;
  const unit = entry.unit ?? "";
  const label = amount === 1 ? unit : (UNIT_PLURAL[unit as Unit] ?? unit);
  const num = Number.isInteger(amount) ? String(amount) : String(amount).replace(".", ",");
  return `${num} ${label}`.trim();
}
