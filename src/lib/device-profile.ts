/**
 * Per-device default profile (M1 Phase B).
 *
 * The household shares ONE Supabase account; both phones sign in as the same
 * user. Which of the two nutrition profiles (Ariel = `me`, Elena = `elena`) a
 * given phone should open on is a property of that phone, not of the account
 * and not of the nutrition data. It is therefore stored in this device's
 * localStorage only and is used for exactly one thing: choosing the initially
 * active profile. It is never read as nutrition data, never synced, and never
 * treated as a source of truth for anything the cloud stores.
 *
 * Until a choice has been made the app asks explicitly ("who uses this
 * device?") so Elena never silently logs as Ariel on a fresh phone.
 */
import type { ProfileId } from "./domain";

export const DEVICE_PROFILE_KEY = "elenas-plate:device-profile:v1";

const VALID: ReadonlySet<string> = new Set<ProfileId>(["me", "elena"]);

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === "string" && VALID.has(value);
}

/** The device's chosen default profile, or null when never chosen. */
export function loadDeviceProfile(): ProfileId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEVICE_PROFILE_KEY);
    return isProfileId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveDeviceProfile(profile: ProfileId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEVICE_PROFILE_KEY, profile);
  } catch (err) {
    console.warn("Failed to persist device profile preference", err);
  }
}

export function clearDeviceProfile(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DEVICE_PROFILE_KEY);
  } catch {
    /* ignore */
  }
}
