/**
 * Hebrew food-name normalization — the single key used for search matching,
 * duplicate prevention and the `foods.normalized_name` column.
 *
 * The goal is that the way a person types a food matches the way it is stored,
 * without an alias subsystem. Three Hebrew-specific problems are handled:
 *
 * 1. Geresh / gershayim variants — `קוטג׳`, `קוטג'`, `קוטג` must be one key.
 * 2. Niqqud — copied or vocalised text must match unvocalised names.
 * 3. Ktiv male / haser — `עגבנייה` and `עגבניה` (or `שווארמה` / `שוארמה`) are
 *    the same word spelled with one or two yods / vavs.
 *
 * Only spelling noise is folded. Distinct foods stay distinct: `פטה` and `פיתה`
 * differ by a real letter, not by a doubled one.
 *
 * Escaped code points are used deliberately so the ranges survive any editor
 * or terminal that mishandles combining marks.
 */

/** Hebrew points + cantillation marks. Excludes U+05BE maqaf (a separator). */
const NIQQUD = /[֑-ֽֿ-ׇ]/g;
/** Geresh, gershayim and every straight / curly quote variant. */
const QUOTES = /[׳״'"`´‘’“”]/g;
/** Maqaf, dashes and slashes act as word separators. */
const SEPARATORS = /[־–—\-/\\]/g;
/** Remaining punctuation carries no meaning for a food name. */
const PUNCTUATION = /[.,;:!?()[\]{}<>|+*=~^&%$#@_]/g;

/**
 * Normalizes a display name to its search / uniqueness key.
 *
 * Idempotent: `normalizeFoodName(normalizeFoodName(x)) === normalizeFoodName(x)`.
 */
export function normalizeFoodName(raw: string): string {
  return raw
    .replace(SEPARATORS, " ")
    .replace(QUOTES, "")
    .replace(NIQQUD, "")
    .replace(PUNCTUATION, " ")
    .toLowerCase()
    .replace(/י{2,}/g, "י") // יי → י (ktiv male)
    .replace(/ו{2,}/g, "ו") // וו → ו (ktiv male)
    .replace(/\s+/g, " ")
    .trim();
}

/** True when two names would collide as the same catalog item. */
export function isSameFoodName(a: string, b: string): boolean {
  return normalizeFoodName(a) === normalizeFoodName(b);
}
