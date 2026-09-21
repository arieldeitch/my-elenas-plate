/**
 * Cleaning + reconciliation of the raw points sheet into the canonical dataset.
 * Pure: raw rows in, dataset + report out. Idempotent and deterministic — the
 * same file always produces byte-identical JSON (ids derive from source
 * version + row, nothing is timestamped here).
 *
 * Every rule is explicit and counted in the report (`cleaningRules` on the
 * item). Nothing is "fixed" by guessing: a truncated name, an unparseable
 * quantity or a missing category becomes `needs_review`, and the source values
 * stay verbatim in `source*` fields for audit.
 */
import { createHash } from "node:crypto";
import { normalizeFoodName } from "../food-normalize";
import { parseQuantityText } from "./quantity-parse";
import type {
  ImportReport,
  ReferenceDataset,
  ReferenceItem,
  ReferenceRule,
  ReferenceSource,
} from "./types";

export interface RawRow {
  /** 1-based row number in the sheet. */
  row: number;
  name: unknown;
  quantity: unknown;
  points: unknown;
  category: unknown;
}

// --- rule catalogue (codes appear in the report and in docs/POINTS_REFERENCE.md)
export const CLEANING_RULES = {
  /** Only the first four columns are read; the side table "מה אכלתי" is ignored. */
  R01_FIRST_FOUR_COLUMNS: "R01_first_four_columns",
  R02_HEADER_ROW_SKIPPED: "R02_header_row_skipped",
  R03_BLANK_ROW_SKIPPED: "R03_blank_row_skipped",
  R04_NON_FOOD_ROW_SKIPPED: "R04_non_food_row_skipped",
  R05_EXACT_DUPLICATE_DEPRECATED: "R05_exact_duplicate_deprecated",
  R06_CONFLICT_SAME_NAME_QUANTITY: "R06_conflict_same_name_quantity",
  R07_CATEGORY_TRUNCATION_FIX: "R07_category_truncation_fix_חלבון_מהח",
  R08_ZERO_POINTS_NO_QUANTITY_ANY: "R08_zero_points_without_quantity_means_any_quantity",
  R09_FRUIT_ALLOWANCE_ATTACHED: "R09_fruit_allowance_row_attached_to_base_food",
  R10_PROTEIN_ALLOWANCE_CONDITIONAL: "R10_protein_zero_allowance_conditional",
  R11_NAME_TRIMMED: "R11_name_whitespace_trimmed",
} as const;

export const REVIEW_REASONS = {
  NAME_TRUNCATED: "name_truncated",
  QUANTITY_MISSING: "quantity_missing_with_points",
  QUANTITY_UNITLESS: "quantity_number_without_unit",
  QUANTITY_UNPARSED: "quantity_unparsed",
  CATEGORY_MISSING: "category_missing",
  CONFLICT: "conflict_same_name_and_quantity",
  BENEFIT_BASE_NOT_FOUND: "benefit_base_food_not_found",
  BENEFIT_NONZERO_POINTS: "benefit_row_with_nonzero_points",
} as const;

const HEADER_NAME = "מאכל או מנה";
const TRUNCATED_CATEGORY = "חלבון מהח";
const FIXED_CATEGORY = "חלבון מהחי";
const PROTEIN_ALLOWANCE_CATEGORY = "תוספת חלבון ב- 0 נקודות";
// Truncated cells keep only a prefix of the clause, so both patterns are prefixes.
const FRUIT_ALLOWANCE = /\(\s*במסגרת\s+3\s+פיר/;
const PROTEIN_ALLOWANCE = /\(\s*במסגרת\s+תו/;

/** Deterministic uuid (sha-256 based, version nibble 5, RFC variant). */
export function referenceItemId(source: ReferenceSource, row: number): string {
  const hex = createHash("sha256").update(`${source.id}|${source.version}|${row}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

/** Unbalanced parentheses or a dangling connector = the cell was cut off. */
export function looksTruncated(name: string): boolean {
  const open = (name.match(/\(/g) ?? []).length;
  const close = (name.match(/\)/g) ?? []).length;
  return open !== close || /[-–,]$/.test(name) || /\sב-?$/.test(name);
}

function quantityKey(raw: unknown): string {
  if (raw == null) return "";
  return String(raw)
    .replace(/[׳״'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pointsPrecision(p: number): "integer" | "half" | "other" {
  if (Number.isInteger(p)) return "integer";
  return Math.abs(p * 2 - Math.round(p * 2)) < 1e-9 ? "half" : "other";
}

/**
 * Turns the raw sheet rows into the canonical dataset + import report.
 */
export function cleanReferenceRows(
  rows: RawRow[],
  source: ReferenceSource,
): { dataset: ReferenceDataset; report: ImportReport } {
  const ruleCounts: Record<string, number> = {};
  const bump = (rule: string, n = 1) => {
    ruleCounts[rule] = (ruleCounts[rule] ?? 0) + n;
  };
  bump(CLEANING_RULES.R01_FIRST_FOUR_COLUMNS, rows.length);

  let headerRows = 0;
  let blankRows = 0;
  let nonFoodRows = 0;
  const items: ReferenceItem[] = [];

  for (const r of rows) {
    if (isBlank(r.name) && isBlank(r.quantity) && isBlank(r.points) && isBlank(r.category)) {
      blankRows++;
      bump(CLEANING_RULES.R03_BLANK_ROW_SKIPPED);
      continue;
    }
    if (typeof r.name === "string" && r.name.trim() === HEADER_NAME) {
      headerRows++;
      bump(CLEANING_RULES.R02_HEADER_ROW_SKIPPED);
      continue;
    }
    const points =
      typeof r.points === "number"
        ? r.points
        : typeof r.points === "string" && r.points.trim() !== ""
          ? Number(r.points)
          : NaN;
    if (typeof r.name !== "string" || r.name.trim() === "" || !Number.isFinite(points)) {
      nonFoodRows++;
      bump(CLEANING_RULES.R04_NON_FOOD_ROW_SKIPPED);
      continue;
    }

    const sourceName = r.name;
    const displayName = sourceName.replace(/\s+/g, " ").trim();
    const cleaning: string[] = [];
    if (displayName !== sourceName) {
      cleaning.push(CLEANING_RULES.R11_NAME_TRIMMED);
      bump(CLEANING_RULES.R11_NAME_TRIMMED);
    }
    const review: string[] = [];
    const notes: string[] = [];

    // Category: verbatim, except the ONE documented truncation.
    const sourceCategory = typeof r.category === "string" ? r.category.trim() : null;
    let category = sourceCategory;
    if (category === TRUNCATED_CATEGORY) {
      category = FIXED_CATEGORY;
      cleaning.push(CLEANING_RULES.R07_CATEGORY_TRUNCATION_FIX);
      bump(CLEANING_RULES.R07_CATEGORY_TRUNCATION_FIX);
    }
    if (!category) review.push(REVIEW_REASONS.CATEGORY_MISSING);

    // Rule detection from the name / category.
    let rule: ReferenceRule | null = null;
    let baseName: string | undefined;
    if (FRUIT_ALLOWANCE.test(displayName)) {
      rule = "fruit_daily_allowance";
      baseName = displayName.slice(0, displayName.indexOf("(")).trim();
    } else if (category === PROTEIN_ALLOWANCE_CATEGORY || PROTEIN_ALLOWANCE.test(displayName)) {
      rule = "protein_zero_allowance";
      baseName = displayName.includes("(")
        ? displayName.slice(0, displayName.indexOf("(")).trim()
        : displayName;
    }

    // Quantity.
    const sourceQuantityText = r.quantity == null ? null : String(r.quantity);
    const parsed = parseQuantityText(r.quantity as string | number | null);
    let portion = parsed.portion;
    if (rule === "protein_zero_allowance") {
      // The sheet writes "0" in the quantity column for these rows: it is the
      // conditional marker, not a measure. Conditional → never auto-applied.
      cleaning.push(CLEANING_RULES.R10_PROTEIN_ALLOWANCE_CONDITIONAL);
      bump(CLEANING_RULES.R10_PROTEIN_ALLOWANCE_CONDITIONAL);
      portion = null;
    } else if ((parsed.missing || parsed.unitless) && points === 0 && category) {
      // Plain vegetables, tea, spices: "." or empty quantity with 0 points.
      portion = { text: sourceQuantityText ?? "", family: "any" };
      cleaning.push(CLEANING_RULES.R08_ZERO_POINTS_NO_QUANTITY_ANY);
      bump(CLEANING_RULES.R08_ZERO_POINTS_NO_QUANTITY_ANY);
    } else if (parsed.missing) {
      review.push(REVIEW_REASONS.QUANTITY_MISSING);
    } else if (parsed.unitless) {
      review.push(REVIEW_REASONS.QUANTITY_UNITLESS);
    } else if (!portion) {
      review.push(REVIEW_REASONS.QUANTITY_UNPARSED);
    }
    if (portion && parsed.unparsed.length > 0) {
      notes.push(`secondary_measure_unparsed:${parsed.unparsed.join("|")}`);
    }

    // Truncated names: benefit rows are recognised by their prefix and are
    // attached to the base food later; any other truncation needs a human.
    if (looksTruncated(displayName) && !rule) review.push(REVIEW_REASONS.NAME_TRUNCATED);
    if (rule && points !== 0) review.push(REVIEW_REASONS.BENEFIT_NONZERO_POINTS);

    const item: ReferenceItem = {
      id: referenceItemId(source, r.row),
      sourceRow: r.row,
      sourceName,
      sourceQuantityText,
      sourcePoints: points,
      sourceCategory,
      displayName,
      normalizedName: normalizeFoodName(displayName),
      category,
      portion,
      points,
      status: "active",
      rule,
      reviewReasons: review,
      cleaningRules: cleaning,
    };
    if (baseName) item.baseName = baseName;
    if (notes.length > 0) item.notes = notes;
    items.push(item);
  }

  // --- exact duplicates and conflicts (same name + same quantity) ---------------
  const byNameQty = new Map<string, ReferenceItem[]>();
  for (const it of items) {
    const key = `${it.normalizedName}#${quantityKey(it.sourceQuantityText)}`;
    byNameQty.set(key, [...(byNameQty.get(key) ?? []), it]);
  }
  let exactDuplicates = 0;
  const conflictGroups: ImportReport["conflictGroups"] = [];
  for (const group of byNameQty.values()) {
    if (group.length < 2) continue;
    const signatures = new Set(group.map((g) => `${g.points}|${g.category ?? ""}`));
    if (signatures.size === 1) {
      const [keep, ...dupes] = group;
      for (const d of dupes) {
        d.status = "deprecated";
        d.duplicateOf = keep.id;
        d.cleaningRules.push(CLEANING_RULES.R05_EXACT_DUPLICATE_DEPRECATED);
        bump(CLEANING_RULES.R05_EXACT_DUPLICATE_DEPRECATED);
        exactDuplicates++;
      }
    } else {
      const cg = `conflict:${group[0].normalizedName}:${quantityKey(group[0].sourceQuantityText)}`;
      for (const g of group) {
        g.status = "conflict";
        g.conflictGroup = cg;
        g.reviewReasons.push(REVIEW_REASONS.CONFLICT);
        g.cleaningRules.push(CLEANING_RULES.R06_CONFLICT_SAME_NAME_QUANTITY);
        bump(CLEANING_RULES.R06_CONFLICT_SAME_NAME_QUANTITY);
      }
      conflictGroups.push({
        name: group[0].displayName,
        quantity: group[0].sourceQuantityText ?? "",
        rows: group.map((g) => g.sourceRow),
        values: group.map((g) => `${g.points} נק׳ · ${g.category ?? "—"}`),
      });
    }
  }

  // --- benefit rows attach to their base food -------------------------------------
  const baseIndex = new Map<string, ReferenceItem[]>();
  for (const it of items) {
    if (it.rule || it.status === "deprecated") continue;
    const k = it.normalizedName;
    baseIndex.set(k, [...(baseIndex.get(k) ?? []), it]);
  }
  let attached = 0;
  let unattached = 0;
  for (const it of items) {
    if (!it.rule || it.rule === "zero_any_quantity" || !it.baseName) continue;
    const candidates = (baseIndex.get(normalizeFoodName(it.baseName)) ?? []).filter(
      (b) => b.status !== "conflict",
    );
    // Deterministic attachment only: exactly one base row of the same portion
    // (fruit) or exactly one base row at all (protein, which has no portion).
    const samePortion =
      it.portion?.grams != null
        ? candidates.filter((b) => b.portion?.grams === it.portion?.grams)
        : candidates;
    const base =
      samePortion.length === 1 ? samePortion[0] : candidates.length === 1 ? candidates[0] : null;
    if (base) {
      it.benefitOf = base.id;
      base.benefits = [
        ...(base.benefits ?? []),
        { itemId: it.id, rule: it.rule, appliedPoints: it.points },
      ];
      if (it.rule === "fruit_daily_allowance") {
        it.cleaningRules.push(CLEANING_RULES.R09_FRUIT_ALLOWANCE_ATTACHED);
        bump(CLEANING_RULES.R09_FRUIT_ALLOWANCE_ATTACHED);
      }
      attached++;
    } else {
      it.reviewReasons.push(REVIEW_REASONS.BENEFIT_BASE_NOT_FOUND);
      unattached++;
    }
  }

  // --- final status -----------------------------------------------------------------
  for (const it of items) {
    if (it.status === "deprecated" || it.status === "conflict") continue;
    if (it.reviewReasons.length > 0) it.status = "needs_review";
  }

  // --- report --------------------------------------------------------------------
  const needsReviewByReason: Record<string, number> = {};
  const categories: Record<string, number> = {};
  const precision = { integer: 0, half: 0, other: 0 };
  const names = new Set<string>();
  const sourceNames = new Set<string>();
  const nameCounts = new Map<string, number>();
  for (const it of items) {
    names.add(it.normalizedName);
    sourceNames.add(it.displayName);
    nameCounts.set(it.normalizedName, (nameCounts.get(it.normalizedName) ?? 0) + 1);
    categories[it.category ?? "(none)"] = (categories[it.category ?? "(none)"] ?? 0) + 1;
    precision[pointsPrecision(it.points)]++;
    if (it.status === "needs_review") {
      for (const reason of it.reviewReasons) {
        needsReviewByReason[reason] = (needsReviewByReason[reason] ?? 0) + 1;
      }
    }
  }

  const report: ImportReport = {
    source,
    rowsInSheet: rows.length,
    headerRows,
    blankRows,
    nonFoodRows,
    foodRows: items.length,
    uniqueSourceNames: sourceNames.size,
    uniqueNames: names.size,
    namesWithVariants: [...nameCounts.values()].filter((n) => n > 1).length,
    exactDuplicatesDeprecated: exactDuplicates,
    conflicts: items.filter((i) => i.status === "conflict").length,
    conflictGroups,
    needsReview: items.filter((i) => i.status === "needs_review").length,
    needsReviewByReason,
    active: items.filter((i) => i.status === "active").length,
    benefitRowsAttached: attached,
    benefitRowsUnattached: unattached,
    cleaningRuleCounts: ruleCounts,
    categories,
    pointsPrecision: precision,
  };

  return { dataset: { source, items }, report };
}
