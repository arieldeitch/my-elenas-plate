import {
  Sunrise,
  Apple,
  Utensils,
  Coffee,
  Soup,
  Moon,
  type LucideIcon,
} from "lucide-react";
import type { MealSlotId } from "./domain";

export const MEAL_LABELS: Record<MealSlotId, string> = {
  breakfast: "ארוחת בוקר",
  morning_snack: "ביניים בוקר",
  lunch: "ארוחת צהריים",
  afternoon_snack: "ביניים אחר הצהריים",
  dinner: "ארוחת ערב",
  late: "ארוחת לילה",
};

export const MEAL_ICONS: Record<MealSlotId, LucideIcon> = {
  breakfast: Sunrise,
  morning_snack: Apple,
  lunch: Utensils,
  afternoon_snack: Coffee,
  dinner: Soup,
  late: Moon,
};

// Soft tinted background per slot for the round meal tile
export const MEAL_TILE_TINT: Record<MealSlotId, string> = {
  breakfast: "bg-amber-50 text-amber-600",
  morning_snack: "bg-rose-50 text-rose-500",
  lunch: "bg-emerald-50 text-emerald-600",
  afternoon_snack: "bg-orange-50 text-orange-500",
  dinner: "bg-sky-50 text-sky-600",
  late: "bg-indigo-50 text-indigo-500",
};
