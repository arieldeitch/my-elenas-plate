import type { DayData, FoodEntry, MealSlotId } from "./domain";
import { MEAL_SLOTS } from "./domain";

export interface LatestActivity {
  slot: MealSlotId;
  entry: FoodEntry;
  /** "HH:mm" when the entry carries a timestamp, else undefined. */
  time?: string;
}

/**
 * The most recent thing logged in a day (M2 home: "what did each of us eat
 * last?"). Prefers `loggedAt` timestamps; entries without one (older rows,
 * demo data) fall back to slot order — the last entry of the last non-empty
 * slot — so the answer is always deterministic.
 */
export function latestActivity(day: DayData): LatestActivity | null {
  let best: LatestActivity | null = null;
  let bestTs = -Infinity;
  for (const slot of MEAL_SLOTS) {
    for (const entry of day.meals[slot].entries) {
      const ts = entry.loggedAt ? Date.parse(entry.loggedAt) : Number.NaN;
      if (Number.isFinite(ts)) {
        if (ts >= bestTs) {
          bestTs = ts;
          best = { slot, entry, time: formatTime(ts) };
        }
      } else if (!Number.isFinite(bestTs)) {
        // No timestamped entry seen yet: slot order decides.
        best = { slot, entry };
      }
    }
  }
  return best;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Entry count across all slots (documented food items, not slots). */
export function countEntries(day: DayData): number {
  return MEAL_SLOTS.reduce((n, s) => n + day.meals[s].entries.length, 0);
}
