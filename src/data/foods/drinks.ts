import { defineFoods } from "./types";

/**
 * משקאות — water, coffee, tea, juices and alcohol.
 *
 * `coffee` (`f_coffee`) is the only `kind: "coffee"` item: picking it opens the
 * structured coffee editor (DEC-014). The named coffee drinks below are ordinary
 * foods, for people who prefer to log "קפוצ׳ינו · כוס" in one tap instead.
 */
export const DRINKS = defineFoods("משקאות", [
  { key: "coffee", name: "קפה", units: "hot", kind: "coffee" },
  { key: "water", name: "מים", units: "water" },
  { key: "sparkling_water", name: "מים מוגזים", units: "water" },
  { key: "soda", name: "סודה", units: "water" },
  { key: "black_coffee", name: "קפה שחור", units: "hot" },
  { key: "instant_coffee", name: "קפה נמס", units: "hot" },
  { key: "espresso", name: "אספרסו", units: "hot" },
  { key: "americano", name: "אמריקנו", units: "hot" },
  { key: "cappuccino", name: "קפוצ׳ינו", units: "hot" },
  { key: "hafuch", name: "קפה הפוך", units: "hot" },
  { key: "latte", name: "לאטה", units: "hot" },
  { key: "tea", name: "תה", units: "hot" },
  { key: "green_tea", name: "תה ירוק", units: "hot" },
  { key: "herbal_tea", name: "תה צמחים", units: "hot" },
  { key: "choco", name: "שוקו", units: "drink" },
  { key: "orange_juice", name: "מיץ תפוזים", units: "drink" },
  { key: "apple_juice", name: "מיץ תפוחים", units: "drink" },
  { key: "grape_juice", name: "מיץ ענבים", units: "drink" },
  { key: "lemonade", name: "לימונדה", units: "drink" },
  { key: "soft_drink", name: "משקה קל", units: "drink" },
  { key: "cola", name: "קולה", units: "drink" },
  { key: "cola_zero", name: "קולה זירו", units: "drink" },
  { key: "energy_drink", name: "משקה אנרגיה", units: "bottle" },
  { key: "fruit_shake", name: "שייק פירות", units: "drink" },
  { key: "smoothie", name: "סמוזי", units: "drink" },
  { key: "beer", name: "בירה", units: "alcohol" },
  { key: "red_wine", name: "יין אדום", units: "alcohol" },
  { key: "white_wine", name: "יין לבן", units: "alcohol" },
  { key: "arak", name: "ערק", units: "alcohol" },
  { key: "vodka", name: "וודקה", units: "alcohol" },
  { key: "whiskey", name: "ויסקי", units: "alcohol" },
]);
