/**
 * Reference scoring engine (DEC-035). Pure. Decides, for ONE reference item
 * and ONE requested quantity, whether the points can be derived safely:
 *
 *   1. exact  — the requested quantity IS the reference portion;
 *   2. scaled — same base family only: grams↔grams, ml↔ml, count↔same count
 *               label (כף only against a כף portion, never כף→כפית);
 *   3. any    — the row is "0 at any quantity" (plain vegetables, tea…);
 *   4. blocked — everything else. Cup→grams, unit→grams, portion→grams,
 *               raw↔cooked, regular↔light, generic↔brand, recipe↔ingredient
 *               are never converted: the first three are structurally blocked
 *               here (no cross-family scaling), the rest by matching only exact
 *               names / verified aliases (`aliasSafetyIssues`).
 *
 * Half-point precision is preserved (rounding to the nearest 0.5, never to a
 * whole number). Conflict / needs_review rows never score.
 */
import type { SubjectiveAmount, Unit } from "../domain";
import { SUBJECTIVE_MULTIPLIER_V2, UNIT_FAMILY, UNIT_TO_GRAMS, UNIT_TO_ML } from "../points-config";
import { normalizeFoodName } from "../food-normalize";
import type { ReferencePortion, ReferenceRule, ReferenceRuntimeItem } from "./types";

export type ResolutionKind = "exact" | "scaled" | "any" | "blocked";

export type BlockReason =
  | "status_not_active"
  | "no_portion"
  | "no_weight_reference"
  | "no_volume_reference"
  | "count_unit_mismatch"
  | "approximate_label_needs_exact_amount"
  | "invalid_amount";

export interface Resolution {
  kind: ResolutionKind;
  /** null only when blocked. */
  points: number | null;
  scale?: number;
  reason?: BlockReason;
}

export type RequestedQuantity =
  | { mode: "measured"; amount: number; unit: Unit }
  | { mode: "subjective"; subjective: SubjectiveAmount };

/** Count labels whose app unit is only an approximation → exact amounts only. */
const APPROXIMATE_LABELS = new Set(["כוסית", "קורט", "צלוחית"]);

export function roundHalfPoint(value: number): number {
  return Math.round(value * 2) / 2;
}

/** Points for a scale factor of the reference portion, half-point precision. */
export function scalePoints(basePoints: number, scale: number): number {
  if (basePoints === 0) return 0;
  const raw = basePoints * scale;
  return Math.max(0.5, roundHalfPoint(raw));
}

/**
 * Resolves the requested quantity against ONE portion + its points. Used for
 * reference items and for custom foods with a confirmed portion.
 */
export function resolvePortion(
  portion: ReferencePortion | null,
  basePoints: number,
  q: RequestedQuantity,
): Resolution {
  if (!portion) return { kind: "blocked", points: null, reason: "no_portion" };
  if (portion.family === "any") return { kind: "any", points: 0, scale: 1 };

  if (q.mode === "subjective") {
    const m = SUBJECTIVE_MULTIPLIER_V2[q.subjective] ?? 1;
    return { kind: m === 1 ? "exact" : "scaled", points: scalePoints(basePoints, m), scale: m };
  }

  const amount = Number(q.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { kind: "blocked", points: null, reason: "invalid_amount" };
  }
  const family = UNIT_FAMILY[q.unit];
  let scale: number | null = null;

  if (family === "weight") {
    if (portion.grams == null)
      return { kind: "blocked", points: null, reason: "no_weight_reference" };
    scale = (amount * (UNIT_TO_GRAMS[q.unit] ?? 1)) / portion.grams;
  } else if (family === "volume") {
    if (portion.ml == null) return { kind: "blocked", points: null, reason: "no_volume_reference" };
    scale = (amount * (UNIT_TO_ML[q.unit] ?? 1)) / portion.ml;
  } else {
    const candidates = [portion.primary, ...(portion.alternatives ?? [])].filter(
      (m): m is NonNullable<typeof m> => !!m && m.family === "count" && m.appUnit === q.unit,
    );
    const match = candidates[0];
    if (!match) return { kind: "blocked", points: null, reason: "count_unit_mismatch" };
    if (APPROXIMATE_LABELS.has(match.label) && amount !== match.amount) {
      return { kind: "blocked", points: null, reason: "approximate_label_needs_exact_amount" };
    }
    scale = amount / match.amount;
  }

  const exact = Math.abs(scale - 1) < 1e-9;
  return {
    kind: exact ? "exact" : "scaled",
    points: exact ? basePoints : scalePoints(basePoints, scale),
    scale,
  };
}

/** Resolution against a reference item (conflict / review rows never score). */
export function resolveReferenceItem(item: ReferenceRuntimeItem, q: RequestedQuantity): Resolution {
  if (item.status !== "active")
    return { kind: "blocked", points: null, reason: "status_not_active" };
  return resolvePortion(item.portion, item.points, q);
}

/** Units the engine can resolve for a portion (what the quantity screen offers). */
export function resolvableUnits(portion: ReferencePortion | null): Unit[] {
  if (!portion) return [];
  if (portion.family === "any") return ["יחידה", "גרם", "כף", "כוס", "מנה", "קערה"];
  const units: Unit[] = [];
  for (const m of [portion.primary, ...(portion.alternatives ?? [])]) {
    if (m?.family === "count" && m.appUnit && !units.includes(m.appUnit as Unit)) {
      units.push(m.appUnit as Unit);
    }
  }
  if (portion.grams != null) for (const u of ["גרם", "ק״ג"] as Unit[]) units.push(u);
  if (portion.ml != null) for (const u of ["מ״ל", "ליטר"] as Unit[]) units.push(u);
  return units;
}

/** The measured quantity that IS the reference portion (the default choice). */
export function portionAsQuantity(
  portion: ReferencePortion | null,
): { amount: number; unit: Unit } | null {
  if (!portion || portion.family === "any" || !portion.primary) return null;
  const p = portion.primary;
  if (p.appUnit) return { amount: p.amount, unit: p.appUnit as Unit };
  if (portion.grams != null) return { amount: portion.grams, unit: "גרם" };
  if (portion.ml != null) return { amount: portion.ml, unit: "מ״ל" };
  return null;
}

export const BLOCK_MESSAGES: Record<BlockReason, string> = {
  status_not_active: "הרשומה במאגר מסומנת לבדיקה ולא ניתן לחשב ממנה ניקוד.",
  no_portion: "לרשומה במאגר אין מנת ייחוס, ולכן אין חישוב אוטומטי.",
  no_weight_reference: "אין המרה בטוחה לגרמים למנת הייחוס הזו — בחרו את יחידת הייחוס.",
  no_volume_reference: "אין המרה בטוחה למ״ל למנת הייחוס הזו — בחרו את יחידת הייחוס.",
  count_unit_mismatch: "היחידה שנבחרה אינה יחידת הייחוס במאגר — אין המרה אוטומטית.",
  approximate_label_needs_exact_amount:
    "מנת הייחוס היא יחידה מקורבת; אפשר לרשום רק את הכמות המדויקת שבמאגר.",
  invalid_amount: "יש להזין כמות חיובית.",
};

// --- benefits (base vs applied points) ---------------------------------------------

export interface BenefitRuleDef {
  label: string;
  /** Uses per profile per day, or null when the source does not state one. */
  dailyCap: number | null;
  /** False = the full rule cannot be proven from the source → never applied. */
  provable: boolean;
}

export const BENEFIT_RULES: Record<Exclude<ReferenceRule, "zero_any_quantity">, BenefitRuleDef> = {
  fruit_daily_allowance: { label: "במסגרת 3 פירות טריים ביום", dailyCap: 3, provable: true },
  protein_zero_allowance: {
    label: "תוספת חלבון ב-0 נקודות (מותנה)",
    dailyCap: null,
    provable: false,
  },
};

export interface BenefitEligibility {
  eligible: boolean;
  usedToday: number;
  cap: number | null;
  reason?: "rule_not_provable" | "cap_reached";
}

/**
 * Whether ONE more use of `rule` is allowed for a profile-day, given the
 * entries already logged that day (each entry counts at most once; the entry
 * being edited is excluded so re-saving it is not a second use).
 */
export function benefitEligibility(
  rule: Exclude<ReferenceRule, "zero_any_quantity">,
  dayEntries: Array<{ id: string; benefitRule?: ReferenceRule | null }>,
  excludingEntryId?: string,
): BenefitEligibility {
  const def = BENEFIT_RULES[rule];
  const seen = new Set<string>();
  for (const e of dayEntries) {
    if (e.benefitRule === rule && e.id !== excludingEntryId) seen.add(e.id);
  }
  const usedToday = seen.size;
  if (!def.provable || def.dailyCap == null) {
    return { eligible: false, usedToday, cap: def.dailyCap, reason: "rule_not_provable" };
  }
  if (usedToday >= def.dailyCap) {
    return { eligible: false, usedToday, cap: def.dailyCap, reason: "cap_reached" };
  }
  return { eligible: true, usedToday, cap: def.dailyCap };
}

/** Applied points for an entry: the benefit replaces the base value only when eligible. */
export function applyBenefit(
  basePoints: number,
  benefit: { rule: ReferenceRule; appliedPoints: number } | undefined,
  eligibility: BenefitEligibility | undefined,
): { basePoints: number; appliedPoints: number; benefitRule: ReferenceRule | null } {
  if (!benefit || benefit.rule === "zero_any_quantity" || !eligibility?.eligible) {
    return { basePoints, appliedPoints: basePoints, benefitRule: null };
  }
  return { basePoints, appliedPoints: benefit.appliedPoints, benefitRule: benefit.rule };
}

// --- alias safety ------------------------------------------------------------------

const COOKING = [/לפני בישול/, /אחרי בישול/, /מבושל/, /יבש/, /טרי/, /קפוא/, /מטוגן/, /אפוי/];
const LIGHT = [/לייט/, /דיאט/, /מופחת/, /דל /, /ללא סוכר/, /ללא שומן/, /\d+(\.\d+)?%/];
const RECIPE = [/מתכון/];

function markers(name: string, patterns: RegExp[]): string {
  return patterns
    .filter((p) => p.test(name))
    .map((p) => p.source)
    .join("|");
}

/** Spelling-preserving key: the ktiv-male fold of normalizeFoodName would turn לייט into ליט. */
function plain(name: string): string {
  return name
    .replace(/[׳״'"]/g, "")
    .replace(/s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Reasons an alias may NOT point at an item. Empty = safe. Guards the
 * forbidden conversions that are about the food's identity rather than its
 * measure: raw↔cooked, regular↔light/diet, generic↔recipe.
 */
export function aliasSafetyIssues(alias: string, itemName: string): string[] {
  if (!normalizeFoodName(alias) || !normalizeFoodName(itemName)) return ["empty"];
  if (normalizeFoodName(alias) === normalizeFoodName(itemName)) return [];
  const a = plain(alias);
  const b = plain(itemName);
  const issues: string[] = [];
  if (markers(a, COOKING) !== markers(b, COOKING)) issues.push("cooking_state_differs");
  if (markers(a, LIGHT) !== markers(b, LIGHT)) issues.push("light_or_diet_variant_differs");
  if (markers(a, RECIPE) !== markers(b, RECIPE)) issues.push("recipe_vs_ingredient");
  return issues;
}

// --- suggestions for a new food ("הצעה לבדיקה") --------------------------------------

export type Confidence = "high" | "medium" | "low";

export interface Suggestion {
  item: ReferenceRuntimeItem;
  similarity: number;
  confidence: Confidence;
}

function tokens(name: string): Set<string> {
  return new Set(
    normalizeFoodName(name)
      .split(" ")
      .filter((t) => t.length > 1),
  );
}

/**
 * Similar ACTIVE reference items for a name the reference does not contain.
 * Never a value to store automatically: the UI shows them as "הצעה לבדיקה"
 * with the source name and a confidence level, and the person confirms.
 */
export function suggestSimilar(
  items: Iterable<ReferenceRuntimeItem>,
  name: string,
  limit = 3,
): Suggestion[] {
  const q = tokens(name);
  if (q.size === 0) return [];
  const out: Suggestion[] = [];
  for (const item of items) {
    if (item.status !== "active" || !item.portion || item.rule === "protein_zero_allowance")
      continue;
    const t = tokens(item.displayName);
    let inter = 0;
    for (const tok of q) if (t.has(tok)) inter++;
    if (inter === 0) continue;
    const similarity = inter / (q.size + t.size - inter);
    const confidence: Confidence =
      similarity >= 0.67 ? "high" : similarity >= 0.4 ? "medium" : "low";
    out.push({ item, similarity, confidence });
  }
  out.sort((x, y) => y.similarity - x.similarity || x.item.sourceRow - y.item.sourceRow);
  return out.slice(0, limit);
}
