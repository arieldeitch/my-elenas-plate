/**
 * Fasting duration math. Pure so the midnight-crossover rule is unit-tested and
 * shared between the fasting card and any future summary/report view.
 */

/**
 * Duration in hours between two "HH:mm" times, handling crossing midnight
 * (e.g. 20:00 → 12:00 = 16h). A window that starts and ends at the same time is
 * treated as a full 24h fast. Returns 0 for unparseable input.
 */
export function calcFastingHours(start: string, end: string): number {
  const s = parseHm(start);
  const e = parseHm(end);
  if (s == null || e == null) return 0;
  let mins = e - s;
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
}

function parseHm(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}
