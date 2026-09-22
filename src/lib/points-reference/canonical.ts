/**
 * Canonical food resolution (DEC-036): the points reference is the ONLY source
 * of the active food list. A legacy catalog food (built-in module or a
 * household `foods` row) may appear only through a verified link to an active
 * reference food, and then only as that reference food — never as a card of
 * its own, never with points of its own.
 *
 * Resolution order for a legacy food (nothing else is ever tried):
 *   1. explicit link   — `food.referenceGroupKey` (personal aliases, DEC-036);
 *   2. verified alias  — `src/data/points-reference/aliases.v1.json`;
 *   3. exact name      — conservative normalisation (`normalizeFoodName`);
 *   4. otherwise       — hidden: not searchable, not addable, not a chip,
 *                        kept for history and listed in the reconciliation report.
 * No fuzzy matching anywhere.
 */
import type { Food, Unit } from "../domain";
import { COFFEE_FOOD_ID } from "../coffee";
import { normalizeFoodName } from "../food-normalize";
import { portionAsQuantity, resolvableUnits } from "./engine";
import {
  findGroupForName,
  groupUnits,
  referenceFoodId,
  type ReferenceGroup,
  type ReferenceIndex,
} from "./index";
import type { ReferenceRuntimeItem } from "./types";

/** A reference row the active list may be built from (DEC-036 §1). */
export function isSelectableItem(item: ReferenceRuntimeItem): boolean {
  if (item.status !== "active" || item.benefitOf) return false;
  if (item.rule === "protein_zero_allowance") return false;
  if (!item.portion) return false;
  if (!Number.isFinite(item.points) || item.points < 0) return false;
  if (Math.abs(item.points * 2 - Math.round(item.points * 2)) > 1e-9) return false;
  if (item.portion.family === "any") return true;
  return resolvableUnits(item.portion).length > 0;
}

/** A group is a valid active food when at least one of its rows is selectable. */
export function selectableItems(group: ReferenceGroup): ReferenceRuntimeItem[] {
  return group.items.filter(isSelectableItem);
}

export type LinkKind = "explicit" | "alias" | "exact";

export interface LegacyResolution {
  food: Food;
  /** The canonical id (`r_…`) the legacy food resolves to, or null when hidden. */
  canonicalId: string | null;
  groupKey: string | null;
  link: LinkKind | null;
}

export interface CanonicalFood extends Food {
  /** `r_<group>` — one per reference food; every active-list entry has exactly one. */
  canonicalId: string;
  referenceGroupKey: string;
  /** Names that find this food in search besides its own: verified aliases, linked legacy names, personal aliases. */
  searchNames: string[];
}

export interface ResolvedCatalog {
  /** The active list: canonical reference foods (+ the coffee editor entry), no duplicates. */
  active: CanonicalFood[];
  /** legacy food id → canonical id (only for linked legacy foods). */
  legacyToCanonical: Map<string, string>;
  /** Legacy foods without a verified link (history only). */
  hidden: Food[];
  resolutions: LegacyResolution[];
  summary: {
    activeReferenceFoods: number;
    legacyFoods: number;
    linkedExplicit: number;
    linkedAlias: number;
    linkedExact: number;
    hidden: number;
    /** Legacy foods that collapsed onto a group another legacy food also links to. */
    duplicatesCollapsed: number;
  };
}

function resolveLegacy(
  index: ReferenceIndex,
  food: Food,
): { group: ReferenceGroup; link: LinkKind } | null {
  if (food.referenceGroupKey) {
    const g = index.groupsByKey.get(food.referenceGroupKey);
    if (g && selectableItems(g).length > 0) return { group: g, link: "explicit" };
  }
  const key = normalizeFoodName(food.name);
  const viaAlias = index.aliasToGroup.get(key);
  if (viaAlias) {
    const g = index.groupsByKey.get(viaAlias);
    if (g && selectableItems(g).length > 0) return { group: g, link: "alias" };
  }
  const exact = index.groupsByKey.get(key);
  if (exact && selectableItems(exact).length > 0) return { group: exact, link: "exact" };
  return null;
}

function cardForGroup(group: ReferenceGroup): CanonicalFood {
  const items = selectableItems(group);
  const usual = portionAsQuantity(items[0].portion);
  const units = groupUnits({ ...group, items });
  const card: CanonicalFood = {
    id: referenceFoodId(group.key),
    canonicalId: referenceFoodId(group.key),
    name: group.name,
    category: group.category ?? undefined,
    defaultUnit: (usual?.unit ?? units[0]) as Unit | undefined,
    suggestedUnits: units.length > 0 ? units : undefined,
    referenceGroupKey: group.key,
    searchNames: [...group.aliases],
  };
  return card;
}

/**
 * Builds the active list from the reference and resolves every legacy food
 * against it. Pure; called once per catalog change in the store.
 */
export function resolveCatalog(index: ReferenceIndex, legacyFoods: Food[]): ResolvedCatalog {
  const cards = new Map<string, CanonicalFood>();
  for (const group of index.groups) {
    if (selectableItems(group).length === 0) continue;
    cards.set(group.key, cardForGroup(group));
  }
  const activeReferenceFoods = cards.size;

  const legacyToCanonical = new Map<string, string>();
  const hidden: Food[] = [];
  const resolutions: LegacyResolution[] = [];
  const claimed = new Map<string, number>();
  let linkedExplicit = 0;
  let linkedAlias = 0;
  let linkedExact = 0;

  for (const food of legacyFoods) {
    if (food.id === COFFEE_FOOD_ID || food.kind === "coffee") continue; // the coffee editor entry, below
    if (food.isActive === false) continue; // archived household row: history only
    const r = resolveLegacy(index, food);
    if (!r) {
      hidden.push(food);
      resolutions.push({ food, canonicalId: null, groupKey: null, link: null });
      continue;
    }
    const card = cards.get(r.group.key)!;
    legacyToCanonical.set(food.id, card.canonicalId);
    claimed.set(r.group.key, (claimed.get(r.group.key) ?? 0) + 1);
    if (normalizeFoodName(food.name) !== r.group.key && !card.searchNames.includes(food.name)) {
      card.searchNames.push(food.name);
    }
    if (r.link === "explicit") linkedExplicit++;
    else if (r.link === "alias") linkedAlias++;
    else linkedExact++;
    resolutions.push({ food, canonicalId: card.canonicalId, groupKey: r.group.key, link: r.link });
  }

  // The structured coffee editor stays (DEC-014); it scores through the
  // reference (`coffeeReferenceGroup`), never through a constant.
  const coffee = legacyFoods.find((f) => f.id === COFFEE_FOOD_ID || f.kind === "coffee");
  const active: CanonicalFood[] = [...cards.values()];
  if (coffee) {
    active.unshift({
      ...coffee,
      canonicalId: COFFEE_FOOD_ID,
      referenceGroupKey: "",
      searchNames: [],
    });
  }

  let duplicatesCollapsed = 0;
  for (const n of claimed.values()) if (n > 1) duplicatesCollapsed += n - 1;

  return {
    active,
    legacyToCanonical,
    hidden,
    resolutions,
    summary: {
      activeReferenceFoods,
      legacyFoods: legacyFoods.filter((f) => f.kind !== "coffee" && f.isActive !== false).length,
      linkedExplicit,
      linkedAlias,
      linkedExact,
      hidden: hidden.length,
      duplicatesCollapsed,
    },
  };
}

/** The canonical id an arbitrary stored food id (legacy or canonical) maps to, if active. */
export function canonicalIdFor(catalog: ResolvedCatalog, foodId: string): string | null {
  if (catalog.active.some((f) => f.id === foodId)) return foodId;
  return catalog.legacyToCanonical.get(foodId) ?? null;
}

// --- coffee ---------------------------------------------------------------------------

/**
 * How a structured coffee entry maps onto the reference (DEC-036 §coffee):
 * black coffee → `אספרסו` (0 at any quantity); with regular / lactose-free milk →
 * `קפוצינו/הפוך 3% שומן`; with low-fat milk → `קפוצינו/ הפוך 1% שומן`; any other
 * milk has no reference row → the entry is saved unscored, never estimated.
 */
export const COFFEE_REFERENCE_TARGETS = {
  black: "אספרסו",
  milkRegular: "קפוצינו/הפוך 3% שומן",
  milkLowFat: "קפוצינו/ הפוך 1% שומן",
} as const;

export function coffeeReferenceGroup(
  index: ReferenceIndex,
  coffee: { milk: string; milkType?: string },
): ReferenceGroup | null {
  let target: string | null;
  if (coffee.milk !== "עם חלב") target = COFFEE_REFERENCE_TARGETS.black;
  else if (coffee.milkType === "חלב רגיל" || coffee.milkType === "חלב ללא לקטוז")
    target = COFFEE_REFERENCE_TARGETS.milkRegular;
  else if (coffee.milkType === "חלב דל שומן") target = COFFEE_REFERENCE_TARGETS.milkLowFat;
  else target = null;
  if (!target) return null;
  const g = findGroupForName(index, target);
  return g && selectableItems(g).length > 0 ? g : null;
}
