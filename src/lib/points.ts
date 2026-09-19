import type { DayData, Food, FoodEntry, SubjectiveAmount, Unit } from "./domain";

export const POINTS_MODEL_VERSION = "v1" as const;
export const DEFAULT_DAILY_POINTS_BUDGET = 30;

const CATEGORY_POINTS: Record<string, number> = {
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

export function portionFactor(
  entry: Pick<FoodEntry, "mode" | "amount" | "unit" | "subjective">,
): number {
  if (entry.mode === "subjective") return entry.subjective ? SUBJECTIVE_FACTOR[entry.subjective] : 1;
  const amount = Math.max(0, entry.amount ?? 0);
  const unit: Unit | undefined = entry.unit;
  if (unit === "גרם") return amount / 100;
  if (unit === "ק״ג") return amount * 10;
  if (unit === "מ״ל") return amount / 250;
  if (unit === "ליטר") return amount * 4;
  if (unit === "חצי יחידה") return amount * 0.5;
  return amount;
}

export function pointsForEntry(entry: FoodEntry | Omit<FoodEntry, "id">, food?: Food): number {
  if (entry.coffee || food?.kind === "coffee") return 0;
  const base = food?.category ? (CATEGORY_POINTS[food.category] ?? 4) : 4;
  if (base === 0) return 0;
  const factor = portionFactor(entry);
  if (factor <= 0) return 0;
  return Math.max(0.5, Math.round(base * factor * 2) / 2);
}

export function resolvedEntryPoints(entry: FoodEntry, food?: Food): number {
  return entry.pointsValue ?? pointsForEntry(entry, food);
}

export function pointsForDay(day: DayData, foods: Food[]): number {
  const byId = new Map(foods.map((food) => [food.id, food]));
  const byName = new Map(foods.map((food) => [food.name, food]));
  return Object.values(day.meals).reduce(
    (total, meal) =>
      total +
      meal.entries.reduce(
        (sum, entry) =>
          sum + resolvedEntryPoints(entry, byId.get(entry.foodId) ?? byName.get(entry.foodName)),
        0,
      ),
    0,
  );
}

export function pointsRemaining(total: number, budget: number): number {
  return Math.round((budget - total) * 2) / 2;
}

export function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
