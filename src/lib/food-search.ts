/**
 * Food search over the active list (canonical reference foods, DEC-036).
 *
 * Pure and index-based so a ~1,100-item list costs one normalization pass per
 * list change instead of one per keystroke, and so the ranking is unit-testable.
 * A food is indexed under its own name AND under its verified / personal
 * aliases (`searchNames`); a hit through an alias still returns the ONE
 * canonical card (never a duplicate) and remembers which name matched so the
 * UI can say "נמצא לפי: תפוח". Results are always capped.
 */
import type { Food } from "./domain";
import { normalizeFoodName } from "./food-normalize";

export type SearchableFood = Food & { searchNames?: string[] };

export interface FoodSearchIndex {
  /** One entry per (food, name) pair; the first entry of a food is its own name. */
  entries: Array<{ food: SearchableFood; normalized: string; name: string; isAlias: boolean }>;
  /** normalized name (own or alias) → food. */
  byNormalized: Map<string, SearchableFood>;
}

export interface FoodSearchHit {
  food: SearchableFood;
  /** The alias the query matched, when it was not the food's own name. */
  matchedAlias?: string;
}

/** Builds the search index for a food list. Call once per list change. */
export function buildFoodSearchIndex(foods: SearchableFood[]): FoodSearchIndex {
  const entries: FoodSearchIndex["entries"] = [];
  const byNormalized = new Map<string, SearchableFood>();
  for (const food of foods) {
    const names = [food.name, ...(food.searchNames ?? [])];
    names.forEach((name, i) => {
      const normalized = normalizeFoodName(name);
      if (!normalized) return;
      entries.push({ food, normalized, name, isAlias: i > 0 });
      if (!byNormalized.has(normalized)) byNormalized.set(normalized, food);
    });
  }
  return { entries, byNormalized };
}

/** The food whose name or alias matches the query exactly (after normalization). */
export function findFoodByName(index: FoodSearchIndex, query: string): SearchableFood | undefined {
  const q = normalizeFoodName(query);
  return q ? index.byNormalized.get(q) : undefined;
}

/**
 * Ranked, capped search with alias awareness.
 *
 * Ranking (best first): exact name → name starts with the query → any word in
 * the name starts with the query → the query appears anywhere. A food's own
 * name ranks before an alias hit of the same tier; list order is the
 * tie-break inside a tier. Each food appears at most once.
 */
export function searchFoodsDetailed(
  index: FoodSearchIndex,
  query: string,
  limit = 20,
): FoodSearchHit[] {
  const q = normalizeFoodName(query);
  if (!q) return [];

  const best = new Map<string, { hit: FoodSearchHit; score: number; order: number }>();
  index.entries.forEach((entry, order) => {
    const tier = rank(entry.normalized, q);
    if (tier < 0) return;
    const score = tier * 2 + (entry.isAlias ? 1 : 0);
    const current = best.get(entry.food.id);
    if (current && current.score <= score) return;
    const hit: FoodSearchHit = { food: entry.food };
    if (entry.isAlias) hit.matchedAlias = entry.name;
    best.set(entry.food.id, { hit, score, order: current?.order ?? order });
  });

  return [...best.values()]
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, limit)
    .map((x) => x.hit);
}

/** Ranked, capped search — foods only (see `searchFoodsDetailed` for the matched alias). */
export function searchFoods(index: FoodSearchIndex, query: string, limit = 20): SearchableFood[] {
  return searchFoodsDetailed(index, query, limit).map((h) => h.food);
}

/** -1 = no match; lower is a better match. */
function rank(normalized: string, query: string): number {
  if (normalized === query) return 0;
  if (normalized.startsWith(query)) return 1;
  const index = normalized.indexOf(query);
  if (index < 0) return -1;
  return normalized[index - 1] === " " ? 2 : 3;
}
