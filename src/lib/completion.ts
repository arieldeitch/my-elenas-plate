import type { DailyMeal, MealSlotId } from "./domain";
import { MEAL_SLOTS } from "./domain";

export type CompletionState = "empty" | "partial" | "full";

export interface CompletionInfo {
  state: CompletionState;
  documented: number;
  total: number;
  label: string;
}

export function calcCompletion(
  meals: Record<MealSlotId, DailyMeal>,
): CompletionInfo {
  const total = MEAL_SLOTS.length;
  const documented = MEAL_SLOTS.filter((s) => meals[s].status !== "empty").length;
  let state: CompletionState = "partial";
  let label = "תיעוד חלקי";
  if (documented === 0) {
    state = "empty";
    label = "עוד לא תועד";
  } else if (documented === total) {
    state = "full";
    label = "התיעוד הושלם";
  }
  return { state, documented, total, label };
}
