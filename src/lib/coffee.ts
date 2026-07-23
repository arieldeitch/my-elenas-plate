/**
 * Coffee entry logic: normalisation, validation and display formatting.
 *
 * Kept as pure functions (no React) so the rules — most importantly "milk type
 * is only valid with milk, and must be cleared otherwise" — are unit-tested and
 * shared by the editor, the store and any future Supabase mapping.
 */
import type { CoffeeMeta, CoffeeType, MilkChoice, MilkType } from "./domain";
import { COFFEE_TYPES, MILK_TYPES } from "./domain";

export const COFFEE_FOOD_ID = "f_coffee";

/**
 * Returns a coffee meta object with irrelevant fields cleared:
 * when milk is "ללא חלב" any previously-selected milk type is removed, so a
 * stale milk type can never persist after switching back to "no milk".
 */
export function normalizeCoffee(meta: CoffeeMeta): CoffeeMeta {
  const next: CoffeeMeta = {
    type: meta.type,
    milk: meta.milk,
  };
  if (meta.milk === "עם חלב" && meta.milkType) {
    next.milkType = meta.milkType;
  }
  const note = meta.note?.trim();
  if (note) next.note = note;
  return next;
}

export type CoffeeValidationError =
  "type" | "milk" | "milkTypeWithoutMilk" | "invalidType" | "invalidMilkType";

/**
 * Validates a coffee meta object. Returns the list of problems (empty = valid).
 * Rejects a milk type supplied without "עם חלב" so invalid combinations are
 * prevented rather than silently normalised away.
 */
export function validateCoffee(meta: Partial<CoffeeMeta>): CoffeeValidationError[] {
  const errors: CoffeeValidationError[] = [];
  if (!meta.type) errors.push("type");
  else if (!COFFEE_TYPES.includes(meta.type as CoffeeType)) errors.push("invalidType");

  if (meta.milk !== "ללא חלב" && meta.milk !== "עם חלב") {
    errors.push("milk");
  }

  if (meta.milk === "ללא חלב" && meta.milkType) {
    errors.push("milkTypeWithoutMilk");
  }
  if (meta.milkType && !MILK_TYPES.includes(meta.milkType as MilkType)) {
    errors.push("invalidMilkType");
  }
  return errors;
}

export function isValidCoffee(meta: Partial<CoffeeMeta>): meta is CoffeeMeta {
  return validateCoffee(meta).length === 0;
}

/** Human-readable one-line summary, e.g. "אמריקנו · עם חלב (שקדים)". */
export function coffeeSummary(meta: CoffeeMeta): string {
  const parts: string[] = [meta.type];
  if (meta.milk === "עם חלב") {
    parts.push(meta.milkType ? `עם חלב (${meta.milkType})` : "עם חלב");
  } else {
    parts.push("ללא חלב");
  }
  return parts.join(" · ");
}

export const DEFAULT_COFFEE: CoffeeMeta = {
  type: "אמריקנו",
  milk: "ללא חלב",
};

export type { CoffeeMeta, CoffeeType, MilkChoice, MilkType };
