/**
 * Auth helpers for the single shared household account. Wraps supabase.auth
 * with friendly Hebrew messages; never surfaces raw Supabase error text.
 */
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./client";

export type AuthResult = { ok: true; message?: string } | { ok: false; message: string };

const GENERIC_ERROR = "משהו השתבש. אפשר לנסות שוב.";

function friendly(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "אימייל או סיסמה שגויים.";
  }
  if (m.includes("email not confirmed")) return "יש לאשר את האימייל לפני הכניסה.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "יותר מדי נסיונות. כדאי להמתין רגע.";
  if (m.includes("network") || m.includes("fetch")) return "אין חיבור לרשת כרגע.";
  return GENERIC_ERROR;
}

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

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: GENERIC_ERROR };
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, message: friendly(error.message) } : { ok: true };
}

export async function signUpWithPassword(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: GENERIC_ERROR };
  const { error } = await sb.auth.signUp({ email: email.trim(), password });
  return error ? { ok: false, message: friendly(error.message) } : { ok: true };
}

export async function signInWithMagicLink(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: GENERIC_ERROR };
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo },
  });
  return error
    ? { ok: false, message: friendly(error.message) }
    : { ok: true, message: "שלחנו קישור כניסה לאימייל." };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}
