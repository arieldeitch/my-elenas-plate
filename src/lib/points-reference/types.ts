/**
 * Canonical points reference ("מאגר הניקוד") — the shared, versioned dataset
 * derived from `docs/data/nutrition-points-source.xlsx` (DEC-035).
 *
 * Three things are kept strictly apart (see docs/POINTS_REFERENCE.md):
 *  1. the canonical shared reference (these types, read-only for the app);
 *  2. a custom food Ariel or Elena created (`Food` with `pointsStatus`);
 *  3. the snapshot inside a logged meal (`FoodEntry.pointsValue` + basis).
 */

export type ReferenceStatus = "active" | "needs_review" | "conflict" | "deprecated";

/**
 * Rules attached to a reference row. None of them is applied automatically:
 *  - `zero_any_quantity`: the source gives 0 points with no quantity (plain
 *    vegetables, tea, spices) → 0 at any quantity;
 *  - `fruit_daily_allowance`: "(במסגרת 3 פירות טריים …)" — a daily benefit,
 *    the row's 0 is `applied`, the base food keeps its own points;
 *  - `protein_zero_allowance`: "תוספת חלבון ב-0 נקודות" — conditional, the
 *    full rule is not provable from the source, so never applied.
 */
export type ReferenceRule =
  | "zero_any_quantity"
  | "fruit_daily_allowance"
  | "protein_zero_allowance";

export type PortionFamily = "weight" | "volume" | "count" | "any";

/** One parsed measure inside a quantity cell ("1 כף", "15 גרם", "250 מ״ל"). */
export interface ParsedMeasure {
  amount: number;
  family: Exclude<PortionFamily, "any">;
  /** Canonical label: גרם / מ״ל, or the count label as written (כף, גביע, לביבה …). */
  label: string;
  /** The app `Unit` this measure maps to, when one exists. */
  appUnit?: string;
}

/**
 * The reference portion of a row. `primary` is the measure written first;
 * `grams` / `ml` are EXPLICIT secondary measures from the same cell
 * ("1 כף / 15 גרם") and are the only conversions the engine may use.
 */
export interface ReferencePortion {
  /** The normalised source text (audit dataset only; absent in the runtime projection). */
  text?: string;
  family: PortionFamily;
  primary?: ParsedMeasure;
  grams?: number;
  ml?: number;
  /** Secondary measures that were parsed but are neither grams nor ml. */
  alternatives?: ParsedMeasure[];
}

/**
 * What the app needs at runtime (bundled, ~⅓ of the audit row). The audit
 * fields live in `ReferenceItem` and are seeded into the database only.
 */
export interface ReferenceRuntimeItem {
  /** Deterministic uuid derived from source id, version and row. */
  id: string;
  sourceRow: number;
  /** Display name as written in the source (trimmed only). */
  displayName: string;
  normalizedName: string;
  category: string | null;
  portion: ReferencePortion | null;
  points: number;
  status: ReferenceStatus;
  rule: ReferenceRule | null;
  benefitOf?: string;
  benefits?: Array<{ itemId: string; rule: ReferenceRule; appliedPoints: number }>;
}

export interface ReferenceItem extends ReferenceRuntimeItem {
  sourceName: string;
  sourceQuantityText: string | null;
  sourcePoints: number;
  sourceCategory: string | null;
  /** For benefit rows: the base food name with the "(במסגרת …" clause removed. */
  baseName?: string;
  reviewReasons: string[];
  cleaningRules: string[];
  conflictGroup?: string;
  duplicateOf?: string;
  notes?: string[];
}

export interface ReferenceSource {
  id: string;
  version: string;
  fileName: string;
  sha256: string;
  sheet: string;
}

export interface ReferenceDataset {
  source: ReferenceSource;
  items: ReferenceItem[];
}

export interface ReferenceRuntimeDataset {
  source: ReferenceSource;
  items: ReferenceRuntimeItem[];
}

/** Projects an audit row to its runtime shape (what `reference.v1.runtime.json` holds). */
export function toRuntimeItem(item: ReferenceItem): ReferenceRuntimeItem {
  const out: ReferenceRuntimeItem = {
    id: item.id,
    sourceRow: item.sourceRow,
    displayName: item.displayName,
    normalizedName: item.normalizedName,
    category: item.category,
    // Hidden rows never score, so their portion is not shipped; the display
    // text of a portion is recomputed by formatPortion() at runtime.
    portion:
      item.status === "active" && item.portion
        ? { ...item.portion, text: undefined as unknown as string }
        : null,
    points: item.points,
    status: item.status,
    rule: item.rule,
  };
  if (item.benefitOf) out.benefitOf = item.benefitOf;
  if (item.benefits) out.benefits = item.benefits;
  return out;
}

export interface ImportReport {
  source: ReferenceSource;
  rowsInSheet: number;
  headerRows: number;
  blankRows: number;
  nonFoodRows: number;
  foodRows: number;
  /** Distinct trimmed source names (1242 in v1). */
  uniqueSourceNames: number;
  /** Distinct normalized search keys (spelling variants fold together). */
  uniqueNames: number;
  namesWithVariants: number;
  exactDuplicatesDeprecated: number;
  conflicts: number;
  conflictGroups: Array<{ name: string; quantity: string; rows: number[]; values: string[] }>;
  needsReview: number;
  needsReviewByReason: Record<string, number>;
  active: number;
  benefitRowsAttached: number;
  benefitRowsUnattached: number;
  cleaningRuleCounts: Record<string, number>;
  categories: Record<string, number>;
  pointsPrecision: { integer: number; half: number; other: number };
}
