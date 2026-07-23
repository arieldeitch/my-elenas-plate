/**
 * Interim demo persistence via localStorage so a refresh, date change or profile
 * switch does not lose data. This is NOT the eventual source of truth — once
 * Supabase is connected it replaces this (see the TODO in store.tsx). SSR-safe:
 * every access is guarded and wrapped so storage being unavailable is non-fatal.
 */
import type { DayData, Food, ProfileId, WeighIn } from "./domain";

const STORAGE_KEY = "elenas-plate:v1";
const VERSION = 1 as const;

type PerProfile<T> = Record<ProfileId, T>;

export interface PersistedState {
  version: typeof VERSION;
  activeProfile: ProfileId;
  days: PerProfile<Record<string, DayData>>;
  weighIns: PerProfile<WeighIn[]>;
  favorites: PerProfile<string[]>;
  recents: PerProfile<string[]>;
  foods: Food[];
}

export function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || parsed.version !== VERSION || !parsed.days) return null;
    return parsed;
  } catch (err) {
    // Corrupt or unavailable storage — fall back to the seeded demo state.
    console.warn("Failed to load saved state", err);
    return null;
  }
}

export function saveState(state: Omit<PersistedState, "version">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...state }));
  } catch (err) {
    // Quota exceeded / private mode — acceptable to drop for a demo.
    console.warn("Failed to persist state", err);
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear state", err);
  }
}
