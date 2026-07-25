import { defineFoods } from "./types";

/** מוצרי חלב ותחליפים — dairy, plant milks and cheeses. */
export const DAIRY = defineFoods("מוצרי חלב ותחליפים", [
  { key: "milk", name: "חלב", units: "water" },
  { key: "milk_low_fat", name: "חלב דל שומן", units: "water" },
  { key: "milk_lactose_free", name: "חלב ללא לקטוז", units: "water" },
  { key: "soy_milk", name: "חלב סויה", units: "water" },
  { key: "almond_milk", name: "חלב שקדים", units: "water" },
  { key: "oat_milk", name: "חלב שיבולת שועל", units: "water" },
  { key: "goat_milk", name: "חלב עיזים", units: "water" },
  { key: "coconut_milk", name: "חלב קוקוס", units: "ml" },
  { key: "yogurt", name: "יוגורט טבעי", units: "cupDairy" },
  { key: "greek_yogurt", name: "יוגורט יווני", units: "cupDairy" },
  { key: "flavored_yogurt", name: "יוגורט בטעמים", units: "cupDairy" },
  { key: "yogurt_drink", name: "משקה יוגורט", units: "bottle" },
  { key: "dairy_dessert", name: "מעדן חלב", units: "cupDairy" },
  { key: "cottage", name: "קוטג׳", units: "grams" },
  { key: "white_cheese", name: "גבינה לבנה", units: "grams" },
  { key: "cream_cheese", name: "גבינת שמנת", units: "spread" },
  { key: "yellow_cheese", name: "גבינה צהובה", units: "slice" },
  { key: "bulgarian_cheese", name: "גבינה בולגרית", units: "grams" },
  { key: "feta", name: "פטה", units: "grams" },
  { key: "mozzarella", name: "מוצרלה", units: "grams" },
  { key: "parmesan", name: "פרמזן", units: "seeds" },
  { key: "ricotta", name: "ריקוטה", units: "grams" },
  { key: "tsfatit", name: "צפתית", units: "grams" },
  { key: "labneh", name: "לאבנה", units: "spread" },
  { key: "goat_cheese", name: "גבינת עיזים", units: "grams" },
  { key: "sour_cream", name: "שמנת חמוצה", units: "spread" },
  { key: "sweet_cream", name: "שמנת מתוקה", units: "spread" },
  { key: "butter", name: "חמאה", units: "spread" },
]);

/** ביצים — the preparations people actually log, not raw ingredients. */
export const EGGS = defineFoods("ביצים", [
  { key: "boiled_egg", name: "ביצה קשה", units: "pieceOnly" },
  { key: "soft_egg", name: "ביצה רכה", units: "pieceOnly" },
  { key: "fried_egg", name: "ביצת עין", units: "pieceOnly" },
  { key: "omelette", name: "חביתה", units: "meatUnit" },
  { key: "scrambled_eggs", name: "ביצים מקושקשות", units: "dish" },
  { key: "shakshuka", name: "שקשוקה", units: "dish" },
  { key: "egg_white", name: "חלבון ביצה", units: "pieceOnly" },
]);
