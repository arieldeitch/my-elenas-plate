/**
 * Supabase browser client (anon key only — never the service_role key).
 *
 * The client is created lazily and only in the browser so SSR never touches
 * localStorage-based session storage. When the env vars are absent the app runs
 * in local demo mode and this module reports `isSupabaseConfigured() === false`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

/** True when both public env vars are present (source of truth = Supabase). */
export function isSupabaseConfigured(): boolean {
  return url.length > 0 && anonKey.length > 0;
}

/** Basic shape validation to fail loudly on obviously wrong values. */
export function validateSupabaseEnv(): { ok: boolean; reason?: string } {
  if (!url && !anonKey) return { ok: true }; // demo mode is valid
  if (!url) return { ok: false, reason: "VITE_SUPABASE_URL is missing" };
  if (!anonKey) return { ok: false, reason: "VITE_SUPABASE_ANON_KEY is missing" };
  if (!/^https?:\/\//.test(url)) {
    return { ok: false, reason: "VITE_SUPABASE_URL must be a URL" };
  }
  return { ok: true };
}

let cached: SupabaseClient<Database> | null = null;

/**
 * Returns the singleton browser client, or null when not configured / on the
 * server. Callers must handle null (demo mode / SSR).
 */
export function getSupabase(): SupabaseClient<Database> | null {
  if (typeof window === "undefined") return null;
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    cached = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // required for magic-link redirects
      },
    });
  }
  return cached;
}

/** Throwing accessor for code paths that already checked configuration. */
export function requireSupabase(): SupabaseClient<Database> {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}
