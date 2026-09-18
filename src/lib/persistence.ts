/**
 * localStorage persistence for LOCAL DEMO MODE ONLY (no Supabase env), so a
 * refresh, date change or profile switch does not lose data there.
 *
 * Not a source of truth: when Supabase is configured the store neither reads nor
 * writes this (see store.tsx), because a stale local snapshot must never be able
 * to reappear in — or be pushed to — the cloud. SSR-safe: every access is
 * guarded so storage being unavailable is non-fatal.
 */
import type { DayData, Food, ProfileId, WeighIn } from "./domain";
import { getBuildInfo } from "./build-info";

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
    // Corrupt or unavailable storage — start empty rather than fail.
    console.warn("Failed to load saved state", err);
    return null;
  }
}

export function saveState(state: Omit<PersistedState, "version">): void {
  if (typeof window === "undefined") return;
  // Belt and braces for DEC-024: a shared build without cloud config is blocked
  // by RuntimeGate before any store exists; should anything still reach here,
  // refuse to create an isolated local-only reality.
  if (getBuildInfo().misconfigured) {
    console.error(
      "[elenas-plate] refusing localStorage write: shared build without Supabase config",
    );
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...state }));
  } catch (err) {
    // Quota exceeded / private mode — acceptable to drop in demo mode.
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
