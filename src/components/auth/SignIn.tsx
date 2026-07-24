import { useState } from "react";
import { Loader2, Mail, KeyRound } from "lucide-react";
import { signInWithMagicLink, signInWithPassword, signUpWithPassword } from "@/lib/supabase/auth";
import { cn } from "@/lib/utils";
import { BrandIllustration } from "@/components/brand/BrandIllustration";

type Mode = "magic" | "password";

/**
 * Sign-in for the shared household account. Magic-link by default, with an
 * email+password fallback. Hebrew RTL, mobile-first, friendly error messages.
 */
export function SignIn() {
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "magic") {
        const res = await signInWithMagicLink(email);
        setMessage(
          res.ok ? { kind: "info", text: res.message! } : { kind: "error", text: res.message },
        );
      } else {
        let res = await signInWithPassword(email, password);
        // First-time shared account: fall back to sign-up if login fails.
        if (!res.ok) res = await signUpWithPassword(email, password);
        if (!res.ok) setMessage({ kind: "error", text: res.message });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex justify-center">
          <BrandIllustration variant="auth" />
        </div>
        <h1 className="mt-2 text-center text-xl font-bold text-foreground">מעקב תזונה משותף</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">כניסה לחשבון המשותף</p>

        <div className="mt-5 inline-flex w-full rounded-full border border-border bg-secondary p-1">
          {(["magic", "password"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setMessage(null);
              }}
              className={cn(
                "flex-1 rounded-full px-3 py-2 text-sm font-semibold",
                mode === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {m === "magic" ? "קישור לאימייל" : "סיסמה"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">
            אימייל
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />

          {mode === "password" && (
            <>
              <label className="block text-sm font-medium" htmlFor="password">
                סיסמה
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
              />
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "magic" ? (
              <Mail className="h-4 w-4" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {mode === "magic" ? "שליחת קישור כניסה" : "כניסה"}
          </button>
        </form>

        {message && (
          <p
            role="status"
            className={cn(
              "mt-3 text-center text-sm",
              message.kind === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
