import {
  Sunrise,
  Apple,
  UtensilsCrossed,
  Coffee,
  Salad,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";
import type { MealSlotId } from "./domain";

export const MEAL_LABELS: Record<MealSlotId, string> = {
  breakfast: "פתיחת חלון אכילה",
  morning_snack: "נשנוש ראשון",
  lunch: "ארוחה מרכזית",
  afternoon_snack: "נשנוש אחר הצהריים",
  dinner: "ארוחת ערב",
  late: "ארוחה נוספת",
};

export const MEAL_ICONS: Record<MealSlotId, LucideIcon> = {
  breakfast: Sunrise,
  morning_snack: Apple,
  lunch: UtensilsCrossed,
  afternoon_snack: Coffee,
  dinner: Salad,
  late: PlusCircle,
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
