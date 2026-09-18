/**
 * Session helpers for the couple app (DEC-031: silent device sessions).
 *
 * There is no login. Each device holds a Supabase ANONYMOUS session — a real
 * authenticated user (role `authenticated`, RLS applies) that identifies the
 * device, not a person. The person (אריאל / אלנה) is the device profile
 * (`lib/device-profile.ts`). `bootstrap_household()` makes every such session a
 * member of the one shared household, so a fresh session (new phone, cleared
 * storage) sees the same cloud data after choosing the person again.
 *
 * The historical email/password + magic-link sign-in was retired on 2026-09-18
 * (RUN_2026-09-18_ACCESS_SIMPLIFICATION.md); an existing permanent session is
 * still honoured by `ensureSession()` because it is simply "a session".
 */
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./client";

export async function getSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/**
 * Returns the device's session, creating a silent anonymous one when none is
 * stored. Throws when the backend cannot be reached or anonymous sign-ins are
 * disabled on the project — the gate shows a plain retry state in that case.
 */
export async function ensureSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const existing = await sb.auth.getSession();
  if (existing.data.session) return existing.data.session;
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}
