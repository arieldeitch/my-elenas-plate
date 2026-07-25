/**
 * The built-in Hebrew food catalog, assembled from the category modules.
 *
 * Role in the architecture (see DEC-019): Supabase `public.foods` is the source
 * of truth for the catalog. This list is the canonical *definition* used to
 * generate the seed SQL, and at runtime it is the fallback the app shows before
 * the seed has been applied, while offline, and in local demo mode. A remote row
 * with the same normalized name always supersedes the entry here.
 */
import type { Food } from "@/lib/domain";
import { VEGETABLES } from "./vegetables";
import { FRUITS } from "./fruits";
import { DAIRY, EGGS } from "./dairy-and-eggs";
import { BREADS, GRAINS } from "./breads-and-grains";
import { LEGUMES } from "./legumes";
import { POULTRY_AND_MEAT, FISH } from "./meat-and-fish";
import { DISHES } from "./dishes";
import { NUTS_AND_SPREADS, SWEETS } from "./snacks-and-sweets";
import { DRINKS } from "./drinks";
import { CONDIMENTS } from "./condiments";

/**
 * Order matters only as a stable tie-break for equally-ranked search results,
 * so the most frequently logged categories come first.
 */
export const BUILT_IN_FOODS: Food[] = [
  ...VEGETABLES,
  ...FRUITS,
  ...DAIRY,
  ...EGGS,
  ...BREADS,
  ...GRAINS,
  ...LEGUMES,
  ...POULTRY_AND_MEAT,
  ...FISH,
  ...DISHES,
  ...NUTS_AND_SPREADS,
  ...SWEETS,
  ...DRINKS,
  ...CONDIMENTS,
];

export { FOOD_CATEGORIES, UNIT_SETS } from "./types";
export type { FoodCategory, FoodDef, UnitSetKey } from "./types";
