import { defineFoods } from "./types";

/**
 * מנות ותבשילים — salads, soups, home cooking and the street food people log
 * as one item. These are logging options only, never a recommendation.
 */
export const DISHES = defineFoods("מנות ותבשילים", [
  // Salads
  // Plain vegetable salads are vegetables (0 points at any quantity, DEC-034),
  // not "dishes"; the dressing is not modelled. Greek salad carries cheese.
  { key: "veg_salad", name: "סלט ירקות", units: "salad", pointsPerPortion: 0 },
  { key: "israeli_salad", name: "סלט ישראלי", units: "salad", pointsPerPortion: 0 },
  { key: "lettuce_salad", name: "סלט חסה", units: "salad", pointsPerPortion: 0 },
  { key: "cabbage_salad", name: "סלט כרוב", units: "salad", pointsPerPortion: 0 },
  { key: "greek_salad", name: "סלט יווני", units: "salad", pointsPerPortion: 2 },
  { key: "tuna_salad", name: "סלט טונה", units: "salad" },
  { key: "egg_salad", name: "סלט ביצים", units: "salad" },
  { key: "quinoa_salad", name: "סלט קינואה", units: "salad" },
  { key: "pasta_salad", name: "סלט פסטה", units: "salad" },
  // Soups
  // Light vegetable soups: low, not the generic dish value.
  { key: "veg_soup", name: "מרק ירקות", units: "soup", pointsPerPortion: 1 },
  { key: "chicken_soup", name: "מרק עוף", units: "soup" },
  { key: "lentil_soup", name: "מרק עדשים", units: "soup" },
  { key: "orange_soup", name: "מרק כתום", units: "soup" },
  { key: "tomato_soup", name: "מרק עגבניות", units: "soup", pointsPerPortion: 1 },
  { key: "mushroom_soup", name: "מרק פטריות", units: "soup", pointsPerPortion: 1 },
  { key: "pea_soup", name: "מרק אפונה", units: "soup" },
  // Grain / pasta mains
  { key: "couscous_veg", name: "קוסקוס עם ירקות", units: "dish" },
  { key: "mujadara", name: "מג׳דרה", units: "dish" },
  { key: "rice_chicken", name: "אורז עם עוף", units: "dish" },
  { key: "ptitim_veg", name: "פתיתים עם ירקות", units: "dish" },
  { key: "pasta_tomato", name: "פסטה ברוטב עגבניות", units: "dish" },
  { key: "pasta_cream", name: "פסטה ברוטב שמנת", units: "dish" },
  { key: "lasagna", name: "לזניה", units: "dish" },
  { key: "ravioli", name: "רביולי", units: "dish" },
  { key: "gnocchi", name: "ניוקי", units: "dish" },
  { key: "moussaka", name: "מוסקה", units: "dish" },
  // Stuffed + patties
  { key: "stuffed_veg", name: "ממולאים", units: "dish" },
  { key: "stuffed_pepper", name: "פלפל ממולא", units: "meatUnit" },
  { key: "stuffed_zucchini", name: "קישוא ממולא", units: "meatUnit" },
  { key: "grape_leaves", name: "עלי גפן", units: "meatUnit" },
  { key: "patties_sauce", name: "קציצות ברוטב", units: "meatUnit" },
  { key: "chicken_patties", name: "קציצות עוף", units: "meatUnit" },
  { key: "veg_patties", name: "קציצות ירק", units: "meatUnit" },
  { key: "levivot", name: "לביבות", units: "meatUnit" },
  // Baked + stews
  { key: "pashtida", name: "פשטידה", units: "dish" },
  { key: "quiche", name: "קיש", units: "dish" },
  { key: "chamin", name: "חמין", units: "dish" },
  { key: "goulash", name: "גולאש", units: "dish" },
  { key: "stirfry_veg", name: "מוקפץ ירקות", units: "dish", pointsPerPortion: 2 },
  { key: "stirfry_chicken", name: "מוקפץ עוף", units: "dish" },
  { key: "stirfry_noodles", name: "נודלס מוקפץ", units: "dish" },
  // Street food + sandwiches
  { key: "sabich", name: "סביח", units: "meatUnit" },
  { key: "falafel_pita", name: "פלאפל בפיתה", units: "meatUnit" },
  { key: "shawarma_pita", name: "שווארמה בפיתה", units: "meatUnit" },
  { key: "hummus_pita", name: "חומוס עם פיתה", units: "dish" },
  { key: "cheese_toast", name: "טוסט גבינה", units: "meatUnit" },
  { key: "sandwich", name: "כריך", units: "meatUnit" },
  { key: "tuna_sandwich", name: "כריך טונה", units: "meatUnit" },
  { key: "omelette_sandwich", name: "כריך חביתה", units: "meatUnit" },
  { key: "pizza", name: "פיצה", units: "dish" },
  { key: "burger_bun", name: "המבורגר בלחמנייה", units: "meatUnit" },
  { key: "hotdog", name: "נקניקייה בלחמנייה", units: "meatUnit" },
  { key: "sushi", name: "סושי", units: "meatUnit" },
  { key: "poke", name: "פוקי", units: "dish" },
  { key: "taco", name: "טאקו", units: "meatUnit" },
]);
