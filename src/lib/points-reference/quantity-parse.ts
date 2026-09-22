/**
 * Parses the free-text quantity column of the points reference into structured
 * measures. Conservative on purpose: anything it does not recognise is left
 * unparsed and reported, never guessed (DEC-035 cleaning rule Q-*).
 *
 * Recognised shapes (from the 130 distinct patterns in the source):
 *   "100 גרם" · "1 כף / 15 גרם" · "1 כוס / 250 מ״ל" · "כוס 250 מ״ל" ·
 *   "2 יחידות" · "חצי כוס" · "רבע יחידה" · "ללביבה" (= 1 לביבה) · "קורט".
 */
import type { ParsedMeasure, PortionFamily, ReferencePortion } from "./types";

const QUOTES = /[׳״'"`´‘’“”]/g;

/** Hebrew unit words → canonical label, family and (when it exists) app unit. */
interface UnitDef {
  label: string;
  family: Exclude<PortionFamily, "any">;
  appUnit?: string;
}

const GRAM: UnitDef = { label: "גרם", family: "weight", appUnit: "גרם" };
const ML: UnitDef = { label: "מ״ל", family: "volume", appUnit: "מ״ל" };
const count = (label: string, appUnit: string): UnitDef => ({ label, family: "count", appUnit });

const UNIT_WORDS: Record<string, UnitDef> = {
  גרם: GRAM,
  גר: GRAM,
  ג: GRAM,
  // מ״ל loses its quote in normalisation → "מל"; the truncated "מ״" becomes "מ"
  // and is deliberately NOT accepted (see parseSegment).
  מל: ML,
  כף: count("כף", "כף"),
  כפות: count("כף", "כף"),
  כפית: count("כפית", "כפית"),
  כפיות: count("כפית", "כפית"),
  כוס: count("כוס", "כוס"),
  כוסות: count("כוס", "כוס"),
  כוסית: count("כוסית", "כוס"),
  יחידה: count("יחידה", "יחידה"),
  יחידות: count("יחידה", "יחידה"),
  יחידו: count("יחידה", "יחידה"),
  יח: count("יחידה", "יחידה"),
  מנה: count("מנה", "מנה"),
  מנות: count("מנה", "מנה"),
  פרוסה: count("פרוסה", "פרוסה"),
  פרוסות: count("פרוסה", "פרוסה"),
  גביע: count("גביע", "יחידה"),
  גביעים: count("גביע", "יחידה"),
  שקית: count("שקית", "יחידה"),
  קופסה: count("קופסה", "יחידה"),
  קופסא: count("קופסה", "יחידה"),
  קופ: count("קופסה", "יחידה"),
  בקבוק: count("בקבוק", "יחידה"),
  בקבוקון: count("בקבוקון", "יחידה"),
  פחית: count("פחית", "יחידה"),
  צנצנת: count("צנצנת", "יחידה"),
  כדור: count("כדור", "יחידה"),
  משולש: count("משולש", "יחידה"),
  קובייה: count("קובייה", "יחידה"),
  קוביות: count("קובייה", "יחידה"),
  צלוחית: count("צלוחית", "קערה"),
  קורט: count("קורט", "כפית"),
  עלה: count("עלה", "יחידה"),
  אצבע: count("אצבע", "יחידה"),
  קלח: count("קלח", "יחידה"),
  שיפוד: count("שיפוד", "יחידה"),
  קציצה: count("קציצה", "יחידה"),
  קציצ: count("קציצה", "יחידה"),
  לביבה: count("לביבה", "יחידה"),
  פלפל: count("פלפל", "יחידה"),
  טורטייה: count("טורטייה", "יחידה"),
  סלק: count("סלק", "יחידה"),
  עוגייה: count("עוגייה", "יחידה"),
  חציל: count("חציל", "יחידה"),
  קישוא: count("קישוא", "יחידה"),
  קבב: count("קבב", "יחידה"),
};

/** Adjectives that qualify a count label and are kept in the display label. */
const MODIFIERS = new Set(["גדושה", "גדולה", "קטנה", "בינונית", "אישית", "בפיתה", "שטוחה"]);

const FRACTION_WORDS: Record<string, number> = { חצי: 0.5, רבע: 0.25 };

export interface ParsedQuantity {
  portion: ReferencePortion | null;
  /** Segments the parser could not understand (reported, never guessed). */
  unparsed: string[];
  /** Number without a unit ("100", "1") — ambiguous by construction. */
  unitless: boolean;
  missing: boolean;
}

function normalizeText(raw: string): string {
  return raw
    .replace(QUOTES, "")
    .replace(/\xa0/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSegment(segment: string): { measures: ParsedMeasure[]; leftover: string[] } {
  const tokens = segment.split(" ").filter(Boolean);
  const measures: ParsedMeasure[] = [];
  const leftover: string[] = [];
  let pendingAmount: number | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    // "250גרם" — a number glued to a unit word.
    const glued = /^(\d+(?:[.,]\d+)?)([א-ת]+)$/.exec(tok);
    if (glued) {
      pendingAmount = Number(glued[1].replace(",", "."));
      tokens.splice(i + 1, 0, glued[2]);
      continue;
    }
    if (/^\d+(?:[.,]\d+)?$/.test(tok)) {
      pendingAmount = Number(tok.replace(",", "."));
      continue;
    }
    if (tok in FRACTION_WORDS) {
      pendingAmount = FRACTION_WORDS[tok];
      continue;
    }
    if (MODIFIERS.has(tok) && measures.length > 0) {
      measures[measures.length - 1].label += ` ${tok}`;
      continue;
    }
    let word = tok;
    let def = UNIT_WORDS[word];
    // "ללביבה" / "למנה" / "ליחידה" — "per <unit>" = 1 unit.
    if (!def && word.startsWith("ל") && word.length > 2 && UNIT_WORDS[word.slice(1)]) {
      word = word.slice(1);
      def = UNIT_WORDS[word];
      if (pendingAmount == null) pendingAmount = 1;
    }
    if (!def) {
      leftover.push(tok);
      continue;
    }
    const measure: ParsedMeasure = {
      amount: pendingAmount ?? 1,
      family: def.family,
      label: def.label,
    };
    if (def.appUnit) measure.appUnit = def.appUnit;
    measures.push(measure);
    pendingAmount = null;
  }
  // A trailing number with no unit word (e.g. "1 קופסה / 250" truncated).
  if (pendingAmount != null) leftover.push(String(pendingAmount));
  return { measures, leftover };
}

/**
 * Parses one quantity cell. `null`, "" and "." are "missing"; a bare number is
 * "unitless"; everything else is parsed segment by segment (split on "/").
 */
export function parseQuantityText(raw: string | number | null | undefined): ParsedQuantity {
  if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
    return { portion: null, unparsed: [], unitless: false, missing: true };
  }
  if (typeof raw === "number") {
    return { portion: null, unparsed: [String(raw)], unitless: true, missing: false };
  }
  const text = normalizeText(raw);
  if (text === "." || text === "") {
    return { portion: null, unparsed: [], unitless: false, missing: true };
  }
  if (/^\d+(?:[.,]\d+)?$/.test(text)) {
    return { portion: null, unparsed: [text], unitless: true, missing: false };
  }

  const measures: ParsedMeasure[] = [];
  const unparsed: string[] = [];
  for (const seg of text.split(" / ")) {
    const { measures: m, leftover } = parseSegment(seg);
    measures.push(...m);
    if (leftover.length > 0) unparsed.push(leftover.join(" "));
  }
  if (measures.length === 0) return { portion: null, unparsed, unitless: false, missing: false };

  const primary = measures[0];
  const portion: ReferencePortion = { text, family: primary.family, primary };
  const alternatives: ParsedMeasure[] = [];
  for (const m of measures.slice(1)) {
    if (m.family === "weight" && portion.grams == null) portion.grams = m.amount;
    else if (m.family === "volume" && portion.ml == null) portion.ml = m.amount;
    else alternatives.push(m);
  }
  if (primary.family === "weight") portion.grams = primary.amount;
  if (primary.family === "volume") portion.ml = primary.amount;
  if (alternatives.length > 0) portion.alternatives = alternatives;
  return { portion, unparsed, unitless: false, missing: false };
}

/** Human display of a reference portion: "1 כף (15 גרם)", "100 גרם", "כל כמות". */
export function formatPortion(portion: ReferencePortion | null): string {
  if (!portion) return "";
  if (portion.family === "any") return "כל כמות";
  const p = portion.primary;
  if (!p) return portion.text ?? "";
  const num = Number.isInteger(p.amount) ? String(p.amount) : String(p.amount).replace(".", ",");
  const main = `${num} ${p.label}`;
  const extra: string[] = [];
  if (p.family !== "weight" && portion.grams != null) extra.push(`${portion.grams} גרם`);
  if (p.family !== "volume" && portion.ml != null) extra.push(`${portion.ml} מ״ל`);
  return extra.length > 0 ? `${main} (${extra.join(" / ")})` : main;
}
