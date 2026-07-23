import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "./AuthGate";
import { SignIn } from "./SignIn";

describe("AuthGate", () => {
  it("renders children in demo mode (Supabase not configured)", () => {
    // No VITE_SUPABASE_* env in tests -> isSupabaseConfigured() is false.
    render(
      <AuthGate>
        <div>app content</div>
      </AuthGate>,
    );
    expect(screen.getByText("app content")).toBeInTheDocument();
  });
});

describe("SignIn", () => {
  it("defaults to magic-link and reveals the password field on toggle", async () => {
    const user = userEvent.setup();
    render(<SignIn />);
    expect(screen.getByRole("button", { name: "שליחת קישור כניסה" })).toBeInTheDocument();
    expect(screen.queryByLabelText("סיסמה")).toBeNull();

    await user.click(screen.getByRole("button", { name: "סיסמה" }));
    expect(screen.getByLabelText("סיסמה")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "כניסה" })).toBeInTheDocument();
  });

  it("has an accessible email field", () => {
    render(<SignIn />);
    expect(screen.getByLabelText("אימייל")).toBeInTheDocument();
  });
});
