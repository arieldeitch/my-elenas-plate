import { describe, it, expect, vi, afterEach } from "vitest";

// Test 8 (hermetic) — cloud/demo mode truth. `isSupabaseConfigured` reads the
// env at import time, so each case mocks the client module explicitly.
afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.doUnmock("./supabase/client");
});

async function load(configured: boolean, prod: boolean) {
  vi.doMock("./supabase/client", () => ({ isSupabaseConfigured: () => configured }));
  vi.stubEnv("PROD", prod);
  vi.stubEnv("VITE_BUILD_SHA", "abc1234");
  return import("./build-info");
}

describe("build identity + runtime mode", () => {
  it("cloud mode when Supabase env is present", async () => {
    const { getBuildInfo, buildLabel } = await load(true, true);
    const info = getBuildInfo();
    expect(info.mode).toBe("cloud");
    expect(info.misconfigured).toBe(false);
    expect(info.sha).toBe("abc1234");
    expect(buildLabel(info)).toBe("build abc1234 · cloud");
  });

  it("demo mode in development is identifiable but not an error", async () => {
    const { getBuildInfo } = await load(false, false);
    const info = getBuildInfo();
    expect(info.mode).toBe("demo");
    expect(info.productionBuild).toBe(false);
    expect(info.misconfigured).toBe(false);
  });

  it("a production bundle without Supabase is flagged as misconfigured", async () => {
    const { getBuildInfo, logBuildInfo } = await load(false, true);
    const info = getBuildInfo();
    expect(info.mode).toBe("demo");
    expect(info.misconfigured).toBe(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logBuildInfo(info);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("WITHOUT SUPABASE CONFIGURATION"));
    expect(
      (window as unknown as { __ELENAS_PLATE_BUILD__?: unknown }).__ELENAS_PLATE_BUILD__,
    ).toEqual(info);
    warn.mockRestore();
  });

  it("falls back to unknown when no SHA was injected", async () => {
    vi.doMock("./supabase/client", () => ({ isSupabaseConfigured: () => true }));
    vi.stubEnv("VITE_BUILD_SHA", "");
    const { getBuildInfo } = await import("./build-info");
    expect(getBuildInfo().sha).toBe("unknown");
  });
});
