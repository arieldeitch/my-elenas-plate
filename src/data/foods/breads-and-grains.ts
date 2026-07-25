import { defineFoods } from "./types";

/** לחם ומאפים — breads, flatbreads, crackers and savoury pastries. */
export const BREADS = defineFoods("לחם ומאפים", [
  { key: "white_bread", name: "לחם לבן", units: "slice" },
  { key: "whole_bread", name: "לחם מלא", units: "slice" },
  { key: "spelt_bread", name: "לחם כוסמין", units: "slice" },
  { key: "rye_bread", name: "לחם שיפון", units: "slice" },
  { key: "sourdough_bread", name: "לחם מחמצת", units: "slice" },
  { key: "light_bread", name: "לחם קל", units: "slice" },
  { key: "bread_slice", name: "פרוסת לחם", units: "slice" },
  { key: "challah", name: "חלה", units: "slice" },
  { key: "pita", name: "פיתה", units: "piece" },
  { key: "whole_pita", name: "פיתה מלאה", units: "piece" },
  { key: "laffa", name: "לאפה", units: "piece" },
  { key: "tortilla", name: "טורטייה", units: "pieceOnly" },
  { key: "roll", name: "לחמנייה", units: "piece" },
  { key: "baguette", name: "בגט", units: "piece" },
  { key: "ciabatta", name: "ג׳בטה", units: "piece" },
  { key: "cracker", name: "קרקר", units: "pieceG" },
  { key: "whole_cracker", name: "קרקר מלא", units: "pieceG" },
  { key: "rice_cake", name: "פריכית אורז", units: "pieceG" },
  { key: "corn_cake", name: "פריכית תירס", units: "pieceG" },
  { key: "matza", name: "מצה", units: "pieceG" },
  { key: "bagel", name: "בייגל", units: "piece" },
  { key: "jerusalem_pretzel", name: "בייגלה ירושלמי", units: "pieceG" },
  { key: "malawach", name: "מלאווח", units: "piece" },
  { key: "jachnun", name: "ג׳חנון", units: "piece" },
  { key: "cheese_burekas", name: "בורקס גבינה", units: "pieceG" },
  { key: "potato_burekas", name: "בורקס תפוח אדמה", units: "pieceG" },
  { key: "croissant", name: "קרואסון", units: "pieceG" },
]);

/**
 * דגנים ופחמימות — grains, pasta and potato sides.
 * Raw vs cooked is distinguished only where it changes what is logged
 * (e.g. תפוחי אדמה אפויים vs מבושלים), never as a duplicate pair.
 */
export const GRAINS = defineFoods("דגנים ופחמימות", [
  { key: "rice", name: "אורז לבן", units: "cooked" },
  { key: "brown_rice", name: "אורז מלא", units: "cooked" },
  { key: "basmati_rice", name: "אורז בסמטי", units: "cooked" },
  { key: "jasmine_rice", name: "אורז יסמין", units: "cooked" },
  { key: "ptitim", name: "פתיתים", units: "cooked" },
  { key: "couscous", name: "קוסקוס", units: "cooked" },
  { key: "bulgur", name: "בורגול", units: "cooked" },
  { key: "quinoa", name: "קינואה", units: "cooked" },
  { key: "buckwheat", name: "כוסמת", units: "cooked" },
  { key: "oats", name: "שיבולת שועל", units: "cereal" },
  { key: "granola", name: "גרנולה", units: "cereal" },
  { key: "cornflakes", name: "קורנפלקס", units: "cereal" },
  { key: "pasta", name: "פסטה", units: "cooked" },
  { key: "spaghetti", name: "ספגטי", units: "cooked" },
  { key: "penne", name: "פנה", units: "cooked" },
  { key: "noodles", name: "נודלס", units: "cooked" },
  { key: "rice_noodles", name: "אטריות אורז", units: "cooked" },
  { key: "polenta", name: "פולנטה", units: "dish" },
  { key: "semolina", name: "סולת", units: "cooked" },
  { key: "mashed_potato", name: "פירה", units: "mash" },
  { key: "baked_potato", name: "תפוחי אדמה אפויים", units: "dish" },
  { key: "boiled_potato", name: "תפוחי אדמה מבושלים", units: "dish" },
  { key: "fries", name: "צ׳יפס", units: "dish" },
  { key: "baked_sweet_potato", name: "בטטה אפויה", units: "dish" },
]);
