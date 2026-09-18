import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * AuthGate (DEC-031): silent device sessions. The Supabase client is faked at
 * the auth-API level so the gate's own logic is exercised: reuse a stored
 * session, otherwise sign in anonymously, never render a form, and show one
 * retry state when the silent connection fails.
 */
const fakeAuth = vi.hoisted(() => ({
  configured: true,
  session: null as null | { user: { id: string }; access_token: string },
  signInAnonymously: vi.fn(),
  listeners: [] as Array<(session: unknown) => void>,
}));

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => fakeAuth.configured,
  getSupabase: () =>
    fakeAuth.configured
      ? {
          auth: {
            getSession: async () => ({ data: { session: fakeAuth.session } }),
            signInAnonymously: fakeAuth.signInAnonymously,
            onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
              fakeAuth.listeners.push((s) => cb("SIGNED_IN", s));
              return { data: { subscription: { unsubscribe: () => {} } } };
            },
          },
        }
      : null,
}));

const { AuthGate } = await import("./AuthGate");

const LOGIN_WORDS = [
  "אימייל",
  "סיסמה",
  "קישור לאימייל",
  "כניסה לחשבון המשותף",
  "שליחת קישור כניסה",
];

function expectNoLoginForm() {
  for (const w of LOGIN_WORDS) expect(screen.queryByText(w)).toBeNull();
  expect(document.querySelector("input[type=email], input[type=password], form")).toBeNull();
}

beforeEach(() => {
  fakeAuth.configured = true;
  fakeAuth.session = null;
  fakeAuth.listeners = [];
  fakeAuth.signInAnonymously.mockReset();
});

describe("AuthGate", () => {
  it("renders children in demo mode (Supabase not configured)", () => {
    fakeAuth.configured = false;
    render(
      <AuthGate>
        <div>app content</div>
      </AuthGate>,
    );
    expect(screen.getByText("app content")).toBeInTheDocument();
  });

  it("reuses an existing session: no sign-in call, straight into the app, no form", async () => {
    fakeAuth.session = { user: { id: "device-1" }, access_token: "t" };
    render(
      <AuthGate>
        <div>app content</div>
      </AuthGate>,
    );
    await screen.findByText("app content");
    expect(fakeAuth.signInAnonymously).not.toHaveBeenCalled();
    expectNoLoginForm();
  });

  it("with no session it signs in anonymously behind the neutral loading state — never a form", async () => {
    let resolve!: (v: unknown) => void;
    fakeAuth.signInAnonymously.mockReturnValue(new Promise((r) => (resolve = r)));
    render(
      <AuthGate>
        <div>app content</div>
      </AuthGate>,
    );
    // While connecting: loading only.
    expect(screen.getByLabelText("טוען")).toBeInTheDocument();
    expect(screen.queryByText("app content")).toBeNull();
    expectNoLoginForm();
    await waitFor(() => expect(fakeAuth.signInAnonymously).toHaveBeenCalledTimes(1));

    resolve({ data: { session: { user: { id: "device-2" }, access_token: "t" } }, error: null });
    await screen.findByText("app content");
    expectNoLoginForm();
  });

  it("shows one plain retry state when the silent connection fails, and retries on tap", async () => {
    const user = userEvent.setup();
    fakeAuth.signInAnonymously
      .mockResolvedValueOnce({
        data: { session: null },
        error: { message: "Anonymous sign-ins are disabled" },
      })
      .mockResolvedValueOnce({
        data: { session: { user: { id: "device-3" }, access_token: "t" } },
        error: null,
      });
    render(
      <AuthGate>
        <div>app content</div>
      </AuthGate>,
    );
    await screen.findByText("לא הצלחנו להתחבר כרגע.");
    expect(screen.queryByText(/Anonymous|Supabase/)).toBeNull();
    expectNoLoginForm();

    await user.click(screen.getByRole("button", { name: "נסה שוב" }));
    await screen.findByText("app content");
    expect(fakeAuth.signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it("a session lost later reconnects silently instead of showing a form", async () => {
    fakeAuth.session = { user: { id: "device-1" }, access_token: "t" };
    fakeAuth.signInAnonymously.mockResolvedValue({
      data: { session: { user: { id: "device-4" }, access_token: "t2" } },
      error: null,
    });
    render(
      <AuthGate>
        <div>app content</div>
      </AuthGate>,
    );
    await screen.findByText("app content");
    fakeAuth.session = null;
    for (const l of fakeAuth.listeners) l(null); // SIGNED_OUT
    await waitFor(() => expect(fakeAuth.signInAnonymously).toHaveBeenCalledTimes(1));
    await screen.findByText("app content");
    expectNoLoginForm();
  });
});
