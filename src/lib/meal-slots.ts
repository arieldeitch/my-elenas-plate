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
