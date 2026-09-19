/**
 * Catalog entry point for the app layer.
 *
 * The items live in category modules under `src/data/foods/` (see that folder's
 * `index.ts` for the authoring rules). This module only re-exports them and adds
 * the merge rule that keeps Supabase authoritative:
 * `mergeCatalog` is the single place where remote `foods` rows and the built-in
 * list are reconciled, by normalized name.
 */
import type { Food } from "./domain";
import { BUILT_IN_FOODS } from "@/data/foods";
import { normalizeFoodName } from "./food-normalize";

export { BUILT_IN_FOODS };
export { FOOD_CATEGORIES } from "@/data/foods";
export type { FoodCategory } from "@/data/foods";

/**
 * The catalog the app starts with, before Supabase hydration. Kept as a distinct
 * name from `BUILT_IN_FOODS` so the store's intent ("initial state") stays
 * readable at the call site.
 */
export const FOOD_CATALOG: Food[] = BUILT_IN_FOODS;

/**
 * Reconciles the household's remote catalog with the built-in list.
 *
 * Supabase is the source of truth (DEC-019):
 *  - a remote row supersedes the built-in entry with the same normalized name —
 *    its category / default unit / kind win, so editing the catalog in the DB is
 *    what the app shows;
 *  - the app-level `id` of a superseded entry stays the built-in `f_*` id, so
 *    favorites and recents (keyed by app food id — DEC-018) survive the seed
 *    being applied;
 *  - a remote row that is `is_active = false` removes the food from the catalog;
 *  - remote rows with no built-in match are the household's custom foods;
 *  - built-in entries with no remote row remain, which is what keeps the app
 *    usable offline and before the seed migration has been applied.
 */
export function mergeCatalog(builtIn: Food[], remote: Food[]): Food[] {
  const remoteByName = new Map<string, Food>();
  for (const food of remote) remoteByName.set(normalizeFoodName(food.name), food);

  const merged: Food[] = [];
  const claimed = new Set<string>();

  for (const food of builtIn) {
    const key = normalizeFoodName(food.name);
    const match = remoteByName.get(key);
    if (!match) {
      merged.push(food);
      continue;
    }
    claimed.add(key);
    if (match.isActive === false) continue; // archived in the DB → hidden in the app
    merged.push({
      ...match,
      id: food.id, // stable app id keeps preferences attached
      kind: match.kind ?? food.kind,
      suggestedUnits: match.suggestedUnits ?? food.suggestedUnits,
      defaultUnit: match.defaultUnit ?? food.defaultUnit,
      // Points calibration lives in the built-in catalog (DEC-034); a seeded
      // cloud row of the same food must not silently drop it.
      pointsPerPortion: match.pointsPerPortion ?? food.pointsPerPortion,
      nutrition: match.nutrition ?? food.nutrition,
    });
  }

  for (const food of remote) {
    const key = normalizeFoodName(food.name);
    if (claimed.has(key) || food.isActive === false) continue;
    claimed.add(key);
    merged.unshift(food); // custom foods first: most recently relevant to the user
  }

  return merged;
}
