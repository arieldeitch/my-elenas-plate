import type { DayData, Food, FoodEntry, SubjectiveAmount, Unit } from "./domain";

export const POINTS_MODEL_VERSION = "v1";
export const DEFAULT_POINTS_BUDGET = 30;

const CATEGORY_BASE: Record<string, number> = {
  "ירקות ועשבי תיבול": 0,
  "פירות": 0,
  "מוצרי חלב ותחליפים": 2,
  "ביצים": 2,
  "לחם ומאפים": 3,
  "דגנים ופחמימות": 4,
  "קטניות": 3,
  "עוף ובשר": 4,
  "דגים": 3,
  "מנות ותבשילים": 5,
  "אגוזים, גרעינים וממרחים": 4,
  "חטיפים ומתוקים": 6,
  "משקאות": 2,
  "רטבים, שמנים ותבלינים": 3,
};

const SUBJECTIVE_FACTOR: Record<SubjectiveAmount, number> = {
  מעט: 0.5,
  במידה: 1,
  הרבה: 1.5,
  מוגזם: 2,
};

export function basePointsForFood(food?: Food): number {
  if (food?.kind === "coffee") return 0;
  if (!food?.category) return 4;
  return CATEGORY_BASE[food.category] ?? 4;
}

export function portionFactor(entry: Pick<FoodEntry, "mode" | "amount" | "unit" | "subjective">): number {
  if (entry.mode === "subjective") {
    return entry.subjective ? SUBJECTIVE_FACTOR[entry.subjective] : 1;
  }
  const amount = Math.max(0, Number(entry.amount ?? 0));
  const unit = entry.unit as Unit | undefined;
  switch (unit) {
    case "גרם":
      return amount / 100;
    case "ק״ג":
      return amount * 10;
    case "מ״ל":
      return amount / 250;
    case "ליטר":
      return amount * 4;
    case "חצי יחידה":
      return amount * 0.5;
    default:
      return amount;
  }
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Internal transparent v1 score. This is deliberately not Weight Watchers'
 * proprietary formula: it uses only the catalog category and reported portion.
 */
export function calculatePointsV1(entry: Pick<FoodEntry, "mode" | "amount" | "unit" | "subjective" | "coffee">, food?: Food): number {
  if (entry.coffee || food?.kind === "coffee") return 0;
  const base = basePointsForFood(food);
  if (base === 0) return 0;
  const factor = portionFactor(entry);
  if (factor <= 0) return 0;
  return Math.max(0.5, roundHalf(base * factor));
}

export function pointsForEntry(entry: FoodEntry, food?: Food): number {
  if (entry.pointsValue != null && Number.isFinite(entry.pointsValue)) return Math.max(0, entry.pointsValue);
  return calculatePointsV1(entry, food);
}

export function pointsForDay(day: DayData, foods: Food[]): number {
  const byId = new Map(foods.map((f) => [f.id, f]));
  let total = 0;
  for (const meal of Object.values(day.meals)) {
    for (const entry of meal.entries) total += pointsForEntry(entry, byId.get(entry.foodId));
  }
  return roundHalf(total);
}

export function pointsRemaining(total: number, budget: number): number {
  return roundHalf(budget - total);
}

export function formatPoints(value: number): string {
  const rounded = roundHalf(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString("he-IL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
