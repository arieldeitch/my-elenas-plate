import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { BuildInfo } from "@/lib/build-info";
import { RuntimeModeNotice } from "./RuntimeModeNotice";

// One hoisted mock with a mutable "current" build info; each case sets it.
const state = vi.hoisted(() => ({
  info: {
    sha: "abc1234",
    builtAt: "2026-09-16T00:00:00Z",
    mode: "cloud",
    productionBuild: true,
    misconfigured: false,
  } as BuildInfo,
}));
vi.mock("@/lib/build-info", () => ({
  getBuildInfo: () => state.info,
  buildLabel: (i: BuildInfo) => `build ${i.sha} · ${i.mode}`,
  logBuildInfo: () => {},
}));

function renderWith(info: Partial<BuildInfo>) {
  state.info = { ...state.info, ...info };
  render(<RuntimeModeNotice />);
}

afterEach(cleanup);

describe("RuntimeModeNotice (Test 8 — cloud/demo truth)", () => {
  it("cloud mode: says data is in the shared cloud, shows the build id, no demo copy", () => {
    renderWith({ mode: "cloud", productionBuild: true, misconfigured: false });
    expect(screen.getByText(/נשמרים בענן המשותף/)).toBeInTheDocument();
    expect(screen.getByText(/build abc1234 · cloud/)).toBeInTheDocument();
    expect(screen.queryByText(/הדגמה/)).toBeNull();
    expect(screen.queryByText(/זמני/)).toBeNull();
    expect(document.querySelector("[data-runtime-mode='cloud']")).toHaveAttribute(
      "data-build-sha",
      "abc1234",
    );
  });

  it("demo mode (dev): clearly labelled, browser-only persistence", () => {
    renderWith({ mode: "demo", productionBuild: false, misconfigured: false });
    expect(screen.getByRole("status")).toHaveTextContent("מצב הדגמה — ללא סנכרון ענן");
    expect(screen.getByText(/בדפדפן הזה בלבד/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("production build without Supabase: loud alert, cannot pass as a cloud build", () => {
    renderWith({ mode: "demo", productionBuild: true, misconfigured: true });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("הבנייה הזו אינה מחוברת לענן");
    expect(alert).toHaveTextContent("VITE_SUPABASE_URL");
    expect(alert).toHaveAttribute("data-runtime-mode", "misconfigured");
    expect(screen.queryByText(/נשמרים בענן המשותף/)).toBeNull();
  });
});
