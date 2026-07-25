/**
 * Food search over the merged catalog (built-in + custom).
 *
 * Pure and index-based so a 400-item catalog costs one normalization pass per
 * list change instead of one per keystroke, and so the ranking is unit-testable.
 * Results are always capped — the UI must never render the whole catalog.
 */
import type { Food } from "./domain";
import { normalizeFoodName } from "./food-normalize";

export interface FoodSearchIndex {
  entries: Array<{ food: Food; normalized: string }>;
  byNormalized: Map<string, Food>;
}

/** Builds the search index for a food list. Call once per list change. */
export function buildFoodSearchIndex(foods: Food[]): FoodSearchIndex {
  const entries = foods.map((food) => ({ food, normalized: normalizeFoodName(food.name) }));
  const byNormalized = new Map<string, Food>();
  for (const { food, normalized } of entries) {
    if (!byNormalized.has(normalized)) byNormalized.set(normalized, food);
  }
  return { entries, byNormalized };
}

/** The food whose name matches the query exactly (after normalization). */
export function findFoodByName(index: FoodSearchIndex, query: string): Food | undefined {
  const q = normalizeFoodName(query);
  return q ? index.byNormalized.get(q) : undefined;
}

/**
 * Ranked, capped search.
 *
 * Ranking (best first): exact name → name starts with the query → any word in
 * the name starts with the query → the query appears anywhere. Catalog order is
 * the tie-break inside a tier, so "תפוח" ranks above "תפוחי אדמה מבושלים" and
 * a search never depends on insertion timing.
 */
export function searchFoods(index: FoodSearchIndex, query: string, limit = 20): Food[] {
  const q = normalizeFoodName(query);
  if (!q) return [];

  const tiers: Food[][] = [[], [], [], []];
  for (const { food, normalized } of index.entries) {
    const tier = rank(normalized, q);
    if (tier >= 0) tiers[tier].push(food);
  }

  const out: Food[] = [];
  for (const tier of tiers) {
    for (const food of tier) {
      if (out.length >= limit) return out;
      out.push(food);
    }
  }
  return out;
}

/** -1 = no match; lower is a better match. */
function rank(normalized: string, query: string): number {
  if (normalized === query) return 0;
  if (normalized.startsWith(query)) return 1;
  const index = normalized.indexOf(query);
  if (index < 0) return -1;
  return normalized[index - 1] === " " ? 2 : 3;
}
