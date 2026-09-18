import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { BuildInfo } from "@/lib/build-info";
import { RuntimeGate } from "./RuntimeGate";

// Mutable build info so each case describes one build shape.
const state = vi.hoisted(() => ({
  info: {
    sha: "abc1234",
    builtAt: "2026-09-18T00:00:00Z",
    mode: "cloud",
    target: "shared",
    targetExplicit: false,
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
  render(
    <RuntimeGate>
      <div data-testid="app">the tracker</div>
    </RuntimeGate>,
  );
}

afterEach(cleanup);

describe("RuntimeGate (DEC-024 fail-safe)", () => {
  it("mounts the app for a configured cloud build", () => {
    renderWith({ mode: "cloud", target: "shared", misconfigured: false });
    expect(screen.getByTestId("app")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("mounts the app for a deliberate demo build", () => {
    renderWith({ mode: "demo", target: "demo", targetExplicit: true, misconfigured: false });
    expect(screen.getByTestId("app")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("blocks the whole app when a shared build has no Supabase configuration", () => {
    // This is the exact shape of the build that was live on 2026-09-18.
    renderWith({ mode: "demo", target: "shared", productionBuild: true, misconfigured: true });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-runtime-mode", "misconfigured");
    expect(alert).toHaveAttribute("data-build-sha", "abc1234");
    expect(alert).toHaveTextContent("אינה מחוברת לענן המשותף");
    expect(alert).toHaveTextContent("VITE_SUPABASE_URL");
    expect(alert).toHaveTextContent("build abc1234 · demo");
    // Nothing of the tracker is mounted — no store, no auth gate, no writes.
    expect(screen.queryByTestId("app")).toBeNull();
  });
});
