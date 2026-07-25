import { defineFoods } from "./types";

/**
 * עוף ובשר — poultry, beef and deli.
 * Preparation variants exist only where they change the logged item
 * (שניצל אפוי / מטוגן, חזה עוף בגריל / מבושל).
 */
export const POULTRY_AND_MEAT = defineFoods("עוף ובשר", [
  { key: "chicken_breast", name: "חזה עוף", units: "meat" },
  { key: "grilled_chicken_breast", name: "חזה עוף בגריל", units: "meat" },
  { key: "cooked_chicken_breast", name: "חזה עוף מבושל", units: "meat" },
  { key: "pargiyot", name: "פרגית", units: "meat" },
  { key: "chicken_drumstick", name: "שוק עוף", units: "meatUnit" },
  { key: "chicken_thigh", name: "כרע עוף", units: "meatUnit" },
  { key: "chicken_wings", name: "כנפי עוף", units: "meatUnit" },
  { key: "roast_chicken", name: "עוף בתנור", units: "dish" },
  { key: "grilled_chicken", name: "עוף בגריל", units: "dish" },
  { key: "chicken_schnitzel", name: "שניצל עוף", units: "meatUnit" },
  { key: "baked_schnitzel", name: "שניצל אפוי", units: "meatUnit" },
  { key: "fried_schnitzel", name: "שניצל מטוגן", units: "meatUnit" },
  { key: "turkey", name: "הודו", units: "meat" },
  { key: "pastrami", name: "פסטרמה", units: "slice" },
  { key: "beef", name: "בשר בקר", units: "meat" },
  { key: "steak", name: "סטייק", units: "meat" },
  { key: "entrecote", name: "אנטריקוט", units: "meat" },
  { key: "sirloin", name: "סינטה", units: "meat" },
  { key: "beef_fillet", name: "פילה בקר", units: "meat" },
  { key: "ground_meat", name: "בשר טחון", units: "meat" },
  { key: "hamburger", name: "המבורגר", units: "meatUnit" },
  { key: "beef_patties", name: "קציצות בקר", units: "meatUnit" },
  { key: "kebab", name: "קבב", units: "meatUnit" },
  { key: "chicken_shawarma", name: "שווארמה עוף", units: "dish" },
  { key: "turkey_shawarma", name: "שווארמה הודו", units: "dish" },
  { key: "beef_shawarma", name: "שווארמה בקר", units: "dish" },
  { key: "asado", name: "אסאדו", units: "meat" },
  { key: "beef_roast", name: "צלי בקר", units: "meat" },
  { key: "chicken_liver", name: "כבד עוף", units: "meat" },
  { key: "lamb", name: "כבש", units: "meat" },
  { key: "sausage", name: "נקניקייה", units: "meatUnit" },
  { key: "deli_sausage", name: "נקניק", units: "slice" },
  { key: "salami", name: "סלמי", units: "slice" },
]);

/** דגים — fish, canned fish and the fish dishes logged as a unit. */
export const FISH = defineFoods("דגים", [
  { key: "salmon", name: "סלמון", units: "meat" },
  { key: "tuna", name: "טונה", units: "meat" },
  { key: "tuna_water", name: "טונה במים", units: "meat" },
  { key: "tuna_oil", name: "טונה בשמן", units: "meat" },
  { key: "white_fish", name: "דג לבן", units: "meat" },
  { key: "tilapia", name: "אמנון", units: "meat" },
  { key: "denis", name: "דניס", units: "meat" },
  { key: "seabass", name: "לברק", units: "meat" },
  { key: "cod", name: "בקלה", units: "meat" },
  { key: "sardines", name: "סרדינים", units: "meat" },
  { key: "mackerel", name: "מקרל", units: "meat" },
  { key: "trout", name: "פורל", units: "meat" },
  { key: "chraime", name: "חריימה", units: "dish" },
  { key: "fish_patties", name: "קציצות דגים", units: "meatUnit" },
  { key: "fried_fish_fillet", name: "פילה דג מטוגן", units: "meatUnit" },
  { key: "baked_fish_fillet", name: "פילה דג אפוי", units: "meatUnit" },
  { key: "shrimp", name: "שרימפס", units: "gramsCup" },
  { key: "salmon_sushi", name: "סושי סלמון", units: "meatUnit" },
  { key: "tuna_sushi", name: "סושי טונה", units: "meatUnit" },
  { key: "sashimi", name: "סשימי", units: "meat" },
]);
