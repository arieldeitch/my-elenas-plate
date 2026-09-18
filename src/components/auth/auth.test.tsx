import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
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

  it("a session lost later reconnects silently in the background — the app stays mounted, no form", async () => {
    fakeAuth.session = { user: { id: "device-1" }, access_token: "t" };
    let resolve!: (v: unknown) => void;
    fakeAuth.signInAnonymously.mockReturnValue(new Promise((r) => (resolve = r)));
    render(
      <AuthGate>
        <div>app content</div>
      </AuthGate>,
    );
    await screen.findByText("app content");
    fakeAuth.session = null;
    act(() => {
      for (const l of fakeAuth.listeners) l(null); // SIGNED_OUT
    });
    await waitFor(() => expect(fakeAuth.signInAnonymously).toHaveBeenCalledTimes(1));
    // While the replacement session is in flight the app is still there.
    expect(screen.getByText("app content")).toBeInTheDocument();
    expect(screen.queryByLabelText("טוען")).toBeNull();
    resolve({ data: { session: { user: { id: "device-4" }, access_token: "t2" } }, error: null });
    await waitFor(() => expect(screen.getByText("app content")).toBeInTheDocument());
    expectNoLoginForm();
  });
});

describe("AuthGate — auth storm safety (one logical attempt never fans out)", () => {
  const failing = () =>
    fakeAuth.signInAnonymously.mockResolvedValue({
      data: { session: null },
      error: { message: "Anonymous sign-ins are disabled" },
    });

  it("StrictMode double mount performs exactly one sign-in", async () => {
    fakeAuth.signInAnonymously.mockResolvedValue({
      data: { session: { user: { id: "d" }, access_token: "t" } },
      error: null,
    });
    render(
      <StrictMode>
        <AuthGate>
          <div>app content</div>
        </AuthGate>
      </StrictMode>,
    );
    await screen.findByText("app content");
    expect(fakeAuth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("auth-null events and online flapping during/after a failed attempt do not add sign-ins", async () => {
    failing();
    render(
      <AuthGate>
        <div>app content</div>
      </AuthGate>,
    );
    // Burst while the first attempt is in flight.
    act(() => {
      for (let i = 0; i < 3; i++) {
        for (const l of fakeAuth.listeners) l(null);
        window.dispatchEvent(new Event("online"));
      }
    });
    await screen.findByText("לא הצלחנו להתחבר כרגע.");
    // Burst right after the failure: inside the automatic-retry gap.
    act(() => {
      for (let i = 0; i < 5; i++) {
        for (const l of fakeAuth.listeners) l(null);
        window.dispatchEvent(new Event("online"));
      }
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(fakeAuth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("repeated retry taps while an attempt is in flight produce one request; a later tap is allowed", async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    fakeAuth.signInAnonymously
      .mockResolvedValueOnce({
        data: { session: null },
        error: { message: "Anonymous sign-ins are disabled" },
      })
      .mockReturnValueOnce(new Promise((r) => (resolve = r)))
      .mockResolvedValue({
        data: { session: { user: { id: "d" }, access_token: "t" } },
        error: null,
      });
    render(
      <AuthGate>
        <div>app content</div>
      </AuthGate>,
    );
    const button = await screen.findByRole("button", { name: "נסה שוב" });
    await user.click(button); // starts the in-flight attempt (2nd call)
    await user.click(button); // ignored (single-flight)
    await user.click(button); // ignored (single-flight)
    expect(fakeAuth.signInAnonymously).toHaveBeenCalledTimes(2);
    resolve({ data: { session: null }, error: { message: "still disabled" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "נסה שוב" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "נסה שוב" })); // manual: never throttled
    await screen.findByText("app content");
    expect(fakeAuth.signInAnonymously).toHaveBeenCalledTimes(3);
  });
});
