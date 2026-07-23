import type { Food, Unit } from "./domain";

const commonMass: Unit[] = ["גרם", "יחידה", "מנה"];
const drinkUnits: Unit[] = ["מ״ל", "כוס", "ליטר"];

export const FOOD_CATALOG: Food[] = [
  { id: "f_coffee", name: "קפה", category: "משקאות", defaultUnit: "כוס", suggestedUnits: ["כוס", "מ״ל"] },
  { id: "f_milk", name: "חלב", category: "משקאות", defaultUnit: "מ״ל", suggestedUnits: drinkUnits },
  { id: "f_omelette", name: "חביתה", category: "בישולים", defaultUnit: "יחידה", suggestedUnits: ["יחידה", "חצי יחידה"] },
  { id: "f_boiled_egg", name: "ביצה קשה", category: "בישולים", defaultUnit: "יחידה", suggestedUnits: ["יחידה", "חצי יחידה"] },
  { id: "f_whole_bread", name: "לחם מלא", category: "מאפים", defaultUnit: "פרוסה", suggestedUnits: ["פרוסה", "גרם"] },
  { id: "f_cottage", name: "קוטג׳", category: "מוצרי חלב", defaultUnit: "גרם", suggestedUnits: ["גרם", "כף", "קערה"] },
  { id: "f_white_cheese", name: "גבינה לבנה", category: "מוצרי חלב", defaultUnit: "גרם", suggestedUnits: ["גרם", "כף"] },
  { id: "f_yogurt", name: "יוגורט", category: "מוצרי חלב", defaultUnit: "יחידה", suggestedUnits: ["יחידה", "גרם"] },
  { id: "f_granola", name: "גרנולה", category: "דגנים", defaultUnit: "כף", suggestedUnits: ["כף", "גרם", "קערה"] },
  { id: "f_apple", name: "תפוח", category: "פירות", defaultUnit: "יחידה", suggestedUnits: ["יחידה", "חצי יחידה"] },
  { id: "f_banana", name: "בננה", category: "פירות", defaultUnit: "יחידה", suggestedUnits: ["יחידה", "חצי יחידה"] },
  { id: "f_almonds", name: "שקדים", category: "אגוזים", defaultUnit: "גרם", suggestedUnits: ["גרם", "כף"] },
  { id: "f_veg_salad", name: "סלט ירקות", category: "ירקות", defaultUnit: "קערה", suggestedUnits: ["קערה", "מנה", "גרם"] },
  { id: "f_rice", name: "אורז", category: "דגנים", defaultUnit: "כוס", suggestedUnits: ["כוס", "גרם"] },
  { id: "f_chicken_breast", name: "חזה עוף", category: "בשר", defaultUnit: "גרם", suggestedUnits: commonMass },
  { id: "f_schnitzel", name: "שניצל", category: "בשר", defaultUnit: "יחידה", suggestedUnits: ["יחידה", "גרם"] },
  { id: "f_tahini", name: "טחינה", category: "ממרחים", defaultUnit: "כף", suggestedUnits: ["כף", "כפית", "גרם"] },
  { id: "f_avocado", name: "אבוקדו", category: "פירות", defaultUnit: "חצי יחידה", suggestedUnits: ["יחידה", "חצי יחידה", "גרם"] },
  { id: "f_soup", name: "מרק", category: "בישולים", defaultUnit: "קערה", suggestedUnits: ["קערה", "מנה", "מ״ל"] },
  { id: "f_pasta", name: "פסטה", category: "דגנים", defaultUnit: "מנה", suggestedUnits: ["מנה", "גרם", "כוס"] },
  { id: "f_fish", name: "דג", category: "בשר", defaultUnit: "גרם", suggestedUnits: commonMass },
  { id: "f_chocolate", name: "שוקולד", category: "מתוקים", defaultUnit: "גרם", suggestedUnits: ["גרם", "יחידה"] },
  { id: "f_icecream", name: "גלידה", category: "מתוקים", defaultUnit: "כדור", suggestedUnits: ["כוס", "קערה", "גרם"] as any },
];

export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
