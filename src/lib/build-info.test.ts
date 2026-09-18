import { describe, it, expect, vi, afterEach } from "vitest";

// Test 8 (hermetic) — cloud/demo mode truth. `isSupabaseConfigured` reads the
// env at import time, so each case mocks the client module explicitly.
afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.doUnmock("./supabase/client");
});

async function load(configured: boolean, prod: boolean, target?: string) {
  vi.doMock("./supabase/client", () => ({ isSupabaseConfigured: () => configured }));
  vi.stubEnv("PROD", prod);
  vi.stubEnv("VITE_BUILD_SHA", "abc1234");
  vi.stubEnv("VITE_RUNTIME_TARGET", target ?? "");
  return import("./build-info");
}

describe("build identity + runtime mode", () => {
  it("cloud mode when Supabase env is present", async () => {
    const { getBuildInfo, buildLabel } = await load(true, true);
    const info = getBuildInfo();
    expect(info.mode).toBe("cloud");
    expect(info.target).toBe("shared");
    expect(info.misconfigured).toBe(false);
    expect(info.sha).toBe("abc1234");
    expect(buildLabel(info)).toBe("build abc1234 · cloud");
  });

  it("demo mode in development is identifiable but not an error", async () => {
    const { getBuildInfo } = await load(false, false);
    const info = getBuildInfo();
    expect(info.mode).toBe("demo");
    expect(info.target).toBe("demo");
    expect(info.targetExplicit).toBe(false);
    expect(info.productionBuild).toBe(false);
    expect(info.misconfigured).toBe(false);
  });

  it("a production bundle without Supabase is misconfigured (the 2026-09-18 live defect)", async () => {
    const { getBuildInfo, logBuildInfo } = await load(false, true);
    const info = getBuildInfo();
    expect(info.mode).toBe("demo");
    expect(info.target).toBe("shared"); // production defaults to the shared couple app
    expect(info.misconfigured).toBe(true);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logBuildInfo(info);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("WITHOUT SUPABASE CONFIGURATION"));
    expect(
      (window as unknown as { __ELENAS_PLATE_BUILD__?: unknown }).__ELENAS_PLATE_BUILD__,
    ).toEqual(info);
    error.mockRestore();
  });

  it("a production bundle may run in demo mode only when it says so explicitly", async () => {
    const { getBuildInfo } = await load(false, true, "demo");
    const info = getBuildInfo();
    expect(info.mode).toBe("demo");
    expect(info.target).toBe("demo");
    expect(info.targetExplicit).toBe(true);
    expect(info.misconfigured).toBe(false);
  });

  it("a development bundle that declares the shared target still requires Supabase", async () => {
    const { getBuildInfo } = await load(false, false, "shared");
    expect(getBuildInfo().misconfigured).toBe(true);
  });

  it("an unknown target value is ignored, not trusted", async () => {
    const { getBuildInfo } = await load(false, true, "production");
    const info = getBuildInfo();
    expect(info.target).toBe("shared");
    expect(info.targetExplicit).toBe(false);
    expect(info.misconfigured).toBe(true);
  });

  it("falls back to unknown when no SHA was injected", async () => {
    vi.doMock("./supabase/client", () => ({ isSupabaseConfigured: () => true }));
    vi.stubEnv("VITE_BUILD_SHA", "");
    const { getBuildInfo } = await import("./build-info");
    expect(getBuildInfo().sha).toBe("unknown");
  });
});
