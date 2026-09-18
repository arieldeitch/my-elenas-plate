import { describe, it, expect, vi, afterEach } from "vitest";

// `isSupabaseConfigured` reads the env at import time; each case re-imports.
afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function load(env: Record<string, string>) {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("./client");
}

const URL = "https://rqgoiuztphkcvbwtbxbj.supabase.co";

describe("Supabase env resolution", () => {
  it("is unconfigured without any values (demo mode)", async () => {
    const { isSupabaseConfigured, validateSupabaseEnv } = await load({});
    expect(isSupabaseConfigured()).toBe(false);
    expect(validateSupabaseEnv()).toEqual({ ok: true });
  });

  it("accepts VITE_SUPABASE_ANON_KEY (this project's name)", async () => {
    const { isSupabaseConfigured } = await load({
      VITE_SUPABASE_URL: URL,
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("accepts VITE_SUPABASE_PUBLISHABLE_KEY (what Lovable's Supabase integration writes)", async () => {
    const { isSupabaseConfigured, validateSupabaseEnv } = await load({
      VITE_SUPABASE_URL: URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    });
    expect(isSupabaseConfigured()).toBe(true);
    expect(validateSupabaseEnv()).toEqual({ ok: true });
  });

  it("a URL without any key is a loud validation failure, not demo mode", async () => {
    const { isSupabaseConfigured, validateSupabaseEnv } = await load({ VITE_SUPABASE_URL: URL });
    expect(isSupabaseConfigured()).toBe(false);
    expect(validateSupabaseEnv().ok).toBe(false);
    expect(validateSupabaseEnv().reason).toMatch(/PUBLISHABLE_KEY/);
  });
});
