import { defineFoods } from "./types";

/** קטניות — cooked legumes, spreads and the plant proteins used in their place. */
export const LEGUMES = defineFoods("קטניות", [
  { key: "chickpeas", name: "חומוס מבושל", units: "cooked" },
  { key: "hummus_spread", name: "ממרח חומוס", units: "spread" },
  { key: "hummus_tahini", name: "טחינה עם חומוס", units: "spread" },
  { key: "green_lentils", name: "עדשים ירוקות", units: "cooked" },
  { key: "red_lentils", name: "עדשים כתומות", units: "cooked" },
  { key: "black_lentils", name: "עדשים שחורות", units: "cooked" },
  { key: "white_beans", name: "שעועית לבנה", units: "cooked" },
  { key: "red_beans", name: "שעועית אדומה", units: "cooked" },
  { key: "black_beans", name: "שעועית שחורה", units: "cooked" },
  { key: "fava_beans", name: "פול", units: "cooked" },
  { key: "black_eyed_peas", name: "לוביה", units: "cooked" },
  { key: "soybeans", name: "סויה", units: "gramsCup" },
  { key: "edamame", name: "אדממה", units: "gramsCup" },
  { key: "falafel", name: "פלאפל", units: "meatUnit" },
  { key: "tofu", name: "טופו", units: "meat" },
]);
