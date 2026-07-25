import { defineFoods } from "./types";

/** רטבים, שמנים ותבלינים — oils, sauces, dressings and basic seasonings. */
export const CONDIMENTS = defineFoods("רטבים, שמנים ותבלינים", [
  { key: "olive_oil", name: "שמן זית", units: "oil" },
  { key: "canola_oil", name: "שמן קנולה", units: "oil" },
  { key: "tomato_sauce", name: "רוטב עגבניות", units: "sauce" },
  { key: "soy_sauce", name: "רוטב סויה", units: "sauce" },
  { key: "teriyaki_sauce", name: "רוטב טריאקי", units: "sauce" },
  { key: "chili_sauce", name: "רוטב צ׳ילי", units: "sauce" },
  { key: "bbq_sauce", name: "רוטב ברביקיו", units: "sauce" },
  { key: "thousand_island", name: "רוטב אלף האיים", units: "sauce" },
  { key: "vinaigrette", name: "ויניגרט", units: "sauce" },
  { key: "lemon_oil_dressing", name: "רוטב לימון ושמן זית", units: "sauce" },
  { key: "balsamic", name: "חומץ בלסמי", units: "sauce" },
  { key: "mayonnaise", name: "מיונז", units: "sauce" },
  { key: "ketchup", name: "קטשופ", units: "sauce" },
  { key: "mustard", name: "חרדל", units: "sauce" },
  { key: "amba", name: "עמבה", units: "sauce" },
  { key: "schug", name: "סחוג", units: "condiment" },
  { key: "salt", name: "מלח", units: "condiment" },
  { key: "sugar", name: "סוכר", units: "condiment" },
]);
