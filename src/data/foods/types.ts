/**
 * Shared vocabulary for the built-in Hebrew food catalog.
 *
 * The catalog is split into category modules (see `./index.ts`) and is the
 * canonical definition used for three things:
 *  1. the offline / pre-seed fallback list in the app,
 *  2. generating the idempotent Supabase seed SQL (`npm run catalog:seed`),
 *  3. validating that both stay in sync (`src/lib/food-catalog.test.ts`).
 *
 * Deliberately absent: calories, macros, health labels, quality scores,
 * favorites and usage counters. Logging options only (DEC-004, DEC-009).
 */
import type { Food, FoodKind, Unit } from "@/lib/domain";

/**
 * Practical unit sets per food shape. The FIRST unit is the default, so a set
 * is chosen for what a person reaches for first when logging that food.
 * Every value must be a member of `Unit` (the app's only unit vocabulary).
 */
export const UNIT_SETS = {
  /** Whole produce eaten by the piece: מלפפון, עגבנייה, תפוח. */
  piece: ["יחידה", "חצי יחידה", "גרם"],
  /** Small whole items where grams are noise: ביצה, קלמנטינה. */
  pieceOnly: ["יחידה", "חצי יחידה"],
  /** Packaged single items: קרקר, מאפין, חטיף. */
  pieceG: ["יחידה", "גרם"],
  /** Usually eaten as half: אבוקדו. */
  half: ["חצי יחידה", "יחידה", "גרם"],
  /** Aromatics measured by clove / teaspoon: שום, פלפל חריף. */
  clove: ["יחידה", "כפית", "גרם"],
  /** Leafy volume: חסה, תרד. */
  leaf: ["קערה", "גרם", "כוס"],
  /** Fresh herbs: פטרוזיליה, נענע. */
  herb: ["כף", "גרם", "כוס"],
  /** Chopped / loose vegetables and berries. */
  gramsCup: ["גרם", "כוס", "מנה"],
  /** Soft weighed foods: קוטג׳, גבינה לבנה. */
  grams: ["גרם", "כף", "קערה"],
  /** Large produce cut into portions: אבטיח, דלעת. */
  bulk: ["מנה", "גרם", "ק״ג"],
  /** Served as a wedge: אננס, פומלה. */
  wedge: ["מנה", "יחידה", "גרם"],
  /** Corn on the cob / kernels. */
  cob: ["יחידה", "כוס", "גרם"],
  /** Nuts, olives, dried-fruit style handfuls. */
  nuts: ["גרם", "כף", "יחידה"],
  /** Citrus used whole or squeezed: לימון. */
  lemon: ["יחידה", "כף", "גרם"],
  /** Dried fruit by the spoon. */
  dried: ["כף", "גרם", "כוס"],
  /** Sliced foods: לחם, גבינה צהובה, פסטרמה. */
  slice: ["פרוסה", "גרם"],
  /** Spreads and soft dips: טחינה, חמאה, ריבה. */
  spread: ["כף", "כפית", "גרם"],
  /** Seeds and hard cheeses grated by the spoon. */
  seeds: ["כף", "גרם", "כפית"],
  /** Single-serve dairy pots: יוגורט, פודינג. */
  cupDairy: ["יחידה", "גרם", "כף"],
  /** Bottled single servings: משקה יוגורט, משקה אנרגיה. */
  bottle: ["יחידה", "מ״ל", "כוס"],
  /** Liquids added by the spoon: חלב קוקוס. */
  ml: ["מ״ל", "כף", "כוס"],
  /** Plain liquids measured by volume: מים, חלב. */
  water: ["מ״ל", "כוס", "ליטר"],
  /** Poured drinks: מיץ, שוקו, משקה קל. */
  drink: ["כוס", "מ״ל", "ליטר"],
  /** Hot drinks: קפה, תה. */
  hot: ["כוס", "ספל", "מ״ל"],
  /** Alcoholic drinks. */
  alcohol: ["כוס", "מ״ל", "יחידה"],
  /** Cooked grains and pasta: אורז מבושל, פסטה. */
  cooked: ["כוס", "כף", "מנה", "גרם"],
  /** Breakfast cereals eaten from a bowl. */
  cereal: ["קערה", "כף", "כוס", "גרם"],
  /** Mashed sides: פירה. */
  mash: ["כף", "קערה", "מנה", "גרם"],
  /** Meat and fish weighed raw or cooked. */
  meat: ["גרם", "יחידה", "מנה"],
  /** Formed items: שניצל, המבורגר, קציצה, כריך. */
  meatUnit: ["יחידה", "מנה", "גרם"],
  /** Plated cooked dishes. */
  dish: ["מנה", "קערה", "גרם"],
  /** Soups. */
  soup: ["קערה", "מנה", "מ״ל"],
  /** Salads. */
  salad: ["קערה", "מנה", "גרם"],
  /** Chocolate and confectionery by weight. */
  sweetG: ["גרם", "יחידה"],
  /** Cakes served as a slice / portion. */
  cake: ["מנה", "פרוסה", "גרם"],
  /** Scooped frozen desserts. */
  frozen: ["כוס", "קערה", "גרם", "יחידה"],
  /** Bagged salty snacks. */
  snackBag: ["יחידה", "גרם", "קערה"],
  /** Popcorn. */
  popcorn: ["קערה", "כוס", "גרם"],
  /** Cooking oils. */
  oil: ["כף", "כפית", "מ״ל"],
  /** Sauces and dressings. */
  sauce: ["כף", "כפית", "מ״ל", "גרם"],
  /** Seasonings used in small amounts. */
  condiment: ["כפית", "כף", "גרם"],
} satisfies Record<string, Unit[]>;

export type UnitSetKey = keyof typeof UNIT_SETS;

/**
 * Catalog categories. Shown as the secondary line in search results, so they
 * are grouping labels only — never a nutritional or quality judgement.
 */
export const FOOD_CATEGORIES = [
  "ירקות ועשבי תיבול",
  "פירות",
  "מוצרי חלב ותחליפים",
  "ביצים",
  "לחם ומאפים",
  "דגנים ופחמימות",
  "קטניות",
  "עוף ובשר",
  "דגים",
  "מנות ותבשילים",
  "אגוזים, גרעינים וממרחים",
  "חטיפים ומתוקים",
  "משקאות",
  "רטבים, שמנים ותבלינים",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/**
 * One catalog item as authored in a category module.
 * `key` is a stable English slug: the app food id is `f_<key>`, so favorites and
 * recents (`food_preferences.food_id`, a text app id — DEC-018) survive both a
 * rename of the Hebrew display name and the arrival of the Supabase seed rows.
 */
export interface FoodDef {
  key: string;
  name: string;
  units: UnitSetKey;
  /** Only `f_coffee` uses `coffee` (opens the structured coffee editor). */
  kind?: FoodKind;
  /**
   * Calibrated points per standard portion (DEC-034 hierarchy step 1). Used
   * where the category fallback is obviously wrong for this food — e.g. a
   * plain vegetable salad filed under "dishes" is still vegetables (0).
   */
  pointsPerPortion?: number;
}

/** Builds the `Food` objects for one category module. */
export function defineFoods(category: FoodCategory, defs: FoodDef[]): Food[] {
  return defs.map((def) => {
    const units = UNIT_SETS[def.units];
    const food: Food = {
      id: `f_${def.key}`,
      name: def.name,
      category,
      defaultUnit: units[0],
      // Copied so a module can never mutate a shared preset array.
      suggestedUnits: [...units],
    };
    if (def.kind) food.kind = def.kind;
    if (def.pointsPerPortion != null) food.pointsPerPortion = def.pointsPerPortion;
    return food;
  });
}
