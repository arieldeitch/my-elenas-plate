import { defineFoods } from "./types";

/** אגוזים, גרעינים וממרחים — nuts, seeds and the spreads kept in the pantry. */
export const NUTS_AND_SPREADS = defineFoods("אגוזים, גרעינים וממרחים", [
  { key: "almonds", name: "שקדים", units: "nuts" },
  { key: "walnuts", name: "אגוזי מלך", units: "nuts" },
  { key: "cashew", name: "קשיו", units: "nuts" },
  { key: "pistachio", name: "פיסטוק", units: "nuts" },
  { key: "peanuts", name: "בוטנים", units: "nuts" },
  { key: "hazelnut", name: "אגוזי לוז", units: "nuts" },
  { key: "pecan", name: "פקאן", units: "nuts" },
  { key: "sunflower_seeds", name: "גרעיני חמנייה", units: "seeds" },
  { key: "pumpkin_seeds", name: "גרעיני דלעת", units: "seeds" },
  { key: "chia", name: "צ׳יה", units: "seeds" },
  { key: "flaxseed", name: "זרעי פשתן", units: "seeds" },
  { key: "sesame", name: "שומשום", units: "seeds" },
  { key: "raw_tahini", name: "טחינה גולמית", units: "spread" },
  { key: "tahini", name: "טחינה מוכנה", units: "spread" },
  { key: "peanut_butter", name: "חמאת בוטנים", units: "spread" },
  { key: "almond_butter", name: "חמאת שקדים", units: "spread" },
  { key: "chocolate_spread", name: "ממרח שוקולד", units: "spread" },
  { key: "jam", name: "ריבה", units: "spread" },
  { key: "honey", name: "דבש", units: "spread" },
  { key: "silan", name: "סילאן", units: "spread" },
  { key: "date_spread", name: "ממרח תמרים", units: "spread" },
  { key: "pesto", name: "פסטו", units: "spread" },
]);

/**
 * חטיפים ומתוקים — snacks and sweets.
 * Listed exactly like every other food: no "treat", "cheat" or quality wording.
 */
export const SWEETS = defineFoods("חטיפים ומתוקים", [
  { key: "milk_chocolate", name: "שוקולד חלב", units: "sweetG" },
  { key: "dark_chocolate", name: "שוקולד מריר", units: "sweetG" },
  { key: "white_chocolate", name: "שוקולד לבן", units: "sweetG" },
  { key: "cookie", name: "עוגייה", units: "pieceG" },
  { key: "chocolate_cake", name: "עוגת שוקולד", units: "cake" },
  { key: "cheesecake", name: "עוגת גבינה", units: "cake" },
  { key: "yeast_cake", name: "עוגת שמרים", units: "cake" },
  { key: "carrot_cake", name: "עוגת גזר", units: "cake" },
  { key: "muffin", name: "מאפין", units: "pieceG" },
  { key: "waffle", name: "ופל", units: "pieceG" },
  { key: "rugelach", name: "רוגלך", units: "pieceG" },
  { key: "ice_cream", name: "גלידה", units: "frozen" },
  { key: "popsicle", name: "ארטיק", units: "pieceG" },
  { key: "chocolate_bar", name: "חטיף שוקולד", units: "pieceG" },
  { key: "energy_bar", name: "חטיף אנרגיה", units: "pieceG" },
  { key: "protein_bar", name: "חטיף חלבון", units: "pieceG" },
  { key: "bisli", name: "ביסלי", units: "snackBag" },
  { key: "bamba", name: "במבה", units: "snackBag" },
  { key: "potato_chips", name: "תפוצ׳יפס", units: "snackBag" },
  { key: "doritos", name: "דוריטוס", units: "snackBag" },
  { key: "popcorn", name: "פופקורן", units: "popcorn" },
  { key: "pretzels", name: "בייגלה", units: "snackBag" },
  { key: "krembo", name: "קרמבו", units: "pieceG" },
  { key: "malabi", name: "מלבי", units: "dish" },
  { key: "pudding", name: "פודינג", units: "cupDairy" },
  { key: "halva", name: "חלבה", units: "sweetG" },
  { key: "baklava", name: "בקלאווה", units: "pieceG" },
  { key: "chocolate_ball", name: "כדור שוקולד", units: "pieceG" },
  { key: "candy", name: "סוכריות", units: "pieceG" },
]);
