/**
 * Runtime access to the canonical points reference: the bundled dataset
 * (`src/data/points-reference/reference.v1.runtime.json` — the runtime
 * projection of the audit dataset the migration seeds into `food_reference_items`), grouped by name into "reference groups"
 * (one food, several portions), and the adapter that shows those groups in
 * the ONE food list the app searches.
 *
 * Only `active` rows are ever offered: `needs_review` and `conflict` rows are
 * kept for audit but are not search results and never score (DEC-035).
 */
import type { Food, Unit } from "../domain";
import { normalizeFoodName } from "../food-normalize";
import dataset from "@/data/points-reference/reference.v1.runtime.json";
import aliasFile from "@/data/points-reference/aliases.v1.json";
import { resolvableUnits } from "./engine";
import { selectableItems } from "./canonical";
import type { ReferenceRuntimeDataset, ReferenceRuntimeItem } from "./types";

export type {
  ReferenceItem,
  ReferencePortion,
  ReferenceRule,
  ReferenceRuntimeItem,
  ReferenceStatus,
} from "./types";
export * from "./engine";
export { formatPortion } from "./quantity-parse";
export * from "./canonical";
export * from "./unit-conversion";

export interface ReferenceGroup {
  /** normalized display name — the search / link key. */
  key: string;
  name: string;
  category: string | null;
  /** Active, scorable rows in source order (the "variations" of the food). */
  items: ReferenceRuntimeItem[];
  /** Rows of this name that are hidden (conflict / needs_review / deprecated). */
  hiddenCount: number;
  /** Verified aliases (other names that mean this food), display form. */
  aliases: string[];
}

/** A verified alias: another name for a reference food (group), never a food of its own. */
export interface ReferenceAlias {
  alias: string;
  /** Display name of the target reference food. */
  target: string;
  verified: boolean;
}

export interface ReferenceIndex {
  version: string;
  itemsById: Map<string, ReferenceRuntimeItem>;
  groupsByKey: Map<string, ReferenceGroup>;
  groups: ReferenceGroup[];
  /** normalized alias → group key (verified aliases only). */
  aliasToGroup: Map<string, string>;
}

/** FNV-1a (32-bit) — stable, dependency-free id for a reference group. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const REFERENCE_FOOD_ID_PREFIX = "r_";

export function referenceFoodId(groupKey: string): string {
  return `${REFERENCE_FOOD_ID_PREFIX}${fnv1a(groupKey)}`;
}

export function isReferenceFoodId(id: string): boolean {
  return id.startsWith(REFERENCE_FOOD_ID_PREFIX);
}

export function buildReferenceIndex(
  data: ReferenceRuntimeDataset,
  aliases: ReferenceAlias[] = [],
): ReferenceIndex {
  const itemsById = new Map<string, ReferenceRuntimeItem>();
  const groupsByKey = new Map<string, ReferenceGroup>();
  for (const item of data.items) {
    itemsById.set(item.id, item);
    // Benefit rows attach to their base food; they are never a food of their own.
    if (item.benefitOf) continue;
    let group = groupsByKey.get(item.normalizedName);
    if (!group) {
      group = {
        key: item.normalizedName,
        name: item.displayName,
        category: item.category,
        items: [],
        hiddenCount: 0,
        aliases: [],
      };
      groupsByKey.set(item.normalizedName, group);
    }
    if (item.status === "active" && item.rule !== "protein_zero_allowance") {
      group.items.push(item);
      if (!group.category && item.category) group.category = item.category;
    } else {
      group.hiddenCount++;
    }
  }
  const aliasToGroup = new Map<string, string>();
  for (const a of aliases) {
    if (!a.verified) continue;
    const group = groupsByKey.get(normalizeFoodName(a.target));
    const key = normalizeFoodName(a.alias);
    // An alias never shadows an OFFERED reference name and never points at two
    // foods (a hidden row of the same name — conflict / review — does not block it).
    const shadow = groupsByKey.get(key);
    if (!group || (shadow && shadow.items.length > 0) || aliasToGroup.has(key)) continue;
    aliasToGroup.set(key, group.key);
    group.aliases.push(a.alias);
  }
  const groups = [...groupsByKey.values()];
  return { version: data.source.version, itemsById, groupsByKey, groups, aliasToGroup };
}

/** The verified aliases shipped with the app (`aliases.v1.json`, DEC-036). */
export const BUNDLED_ALIASES: ReferenceAlias[] = (
  aliasFile as { aliases: Array<{ alias: string; target: string }> }
).aliases.map((a) => ({ alias: a.alias, target: a.target, verified: true }));

let cached: ReferenceIndex | null = null;

/** The bundled reference, built once per process. */
export function getReferenceIndex(): ReferenceIndex {
  if (!cached) cached = buildReferenceIndex(dataset as ReferenceRuntimeDataset, BUNDLED_ALIASES);
  return cached;
}

/** The group a food name resolves to: exact normalized name, then verified alias. */
export function findGroupForName(index: ReferenceIndex, name: string): ReferenceGroup | undefined {
  const key = normalizeFoodName(name);
  const direct = index.groupsByKey.get(key);
  if (direct) return direct;
  const viaAlias = index.aliasToGroup.get(key);
  return viaAlias ? index.groupsByKey.get(viaAlias) : undefined;
}

/** Units the quantity screen should offer for a group (union over its portions). */
export function groupUnits(group: ReferenceGroup): Unit[] {
  const out: Unit[] = [];
  for (const item of group.items) {
    for (const u of resolvableUnits(item.portion)) if (!out.includes(u)) out.push(u);
  }
  return out;
}

/** Points range of a group's active portions, for the compact secondary line. */
export function groupPointsSummary(group: ReferenceGroup): { min: number; max: number } | null {
  if (group.items.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const item of group.items) {
    min = Math.min(min, item.points);
    max = Math.max(max, item.points);
  }
  return { min, max };
}

/** The reference group a food is linked to (or represents), if any. */
export function groupForFood(index: ReferenceIndex, food: Pick<Food, "referenceGroupKey">) {
  return food.referenceGroupKey ? index.groupsByKey.get(food.referenceGroupKey) : undefined;
}

/**
 * The one-tap quantity of a reference-linked food: the reference portion
 * itself, and only when the group has exactly ONE active portion whose
 * primary measure is a count unit (2 יחידות, 1 פרוסה). Several portions =
 * the person must choose; a weight/volume portion = the quantity screen.
 */
export function usualReferenceQuantity(
  index: ReferenceIndex,
  food: Pick<Food, "referenceGroupKey">,
): { mode: "measured"; amount: number; unit: Unit; referenceItemId: string } | null {
  const group = groupForFood(index, food);
  const rows = group ? selectableItems(group) : [];
  if (rows.length !== 1) return null;
  const item = rows[0];
  if (!item.portion) return null;
  // 0 at any quantity (plain vegetables, tea): one portion is a truthful one-tap add.
  if (item.portion.family === "any") {
    return { mode: "measured", amount: 1, unit: "מנה", referenceItemId: item.id };
  }
  const p = item.portion.primary;
  if (item.portion.family !== "count" || !p?.appUnit) return null;
  return { mode: "measured", amount: p.amount, unit: p.appUnit as Unit, referenceItemId: item.id };
}

/** Food groups of the source, as shown in the new-food form (order = source frequency). */
export const REFERENCE_CATEGORIES: readonly string[] = [
  "חלבון מהחי",
  "חלבון מהצומח",
  "דגנים ופחמימות",
  "קטניות",
  "ירקות",
  "פירות",
  "מוצרי חלב",
  "שומנים",
  "משקאות",
  "אוכל בחוץ",
  "חטיפים מלוחים",
  "חטיפים ממרחים ומתוקים",
  "רטבים אבקות חלב ותבלינים",
  "סלטים מוכנים",
];
