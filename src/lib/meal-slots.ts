import {
  Sunrise,
  Apple,
  Utensils,
  Coffee,
  Salad,
  Moon,
  type LucideIcon,
} from "lucide-react";
import type { MealSlotId } from "./domain";

export const MEAL_LABELS: Record<MealSlotId, string> = {
  breakfast: "ארוחת בוקר",
  morning_snack: "ביניים בוקר",
  lunch: "ארוחת צהריים",
  afternoon_snack: "ביניים אחה״צ",
  dinner: "ארוחת ערב",
  late: "ארוחת לילה",
};

export const MEAL_ICONS: Record<MealSlotId, LucideIcon> = {
  breakfast: Sunrise,
  morning_snack: Apple,
  lunch: Utensils,
  afternoon_snack: Coffee,
  dinner: Salad,
  late: Moon,
};

// Soft healthcare pastel per slot
export const MEAL_TILE_TINT: Record<MealSlotId, string> = {
  breakfast: "bg-[#FFF4E0] text-[#C88A2E]",
  morning_snack: "bg-[#FDECEC] text-[#C85454]",
  lunch: "bg-[#EDF8F2] text-[#17A668]",
  afternoon_snack: "bg-[#FFF0E0] text-[#D18544]",
  dinner: "bg-[#EDF6FD] text-[#2B84D6]",
  late: "bg-[#EEEEFB] text-[#6A6DCB]",
};
