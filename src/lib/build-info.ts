/**
 * Build identity + runtime mode (M1 Phase A — "runtime truth").
 *
 * `VITE_BUILD_SHA` / `VITE_BUILD_TIME` are injected at build time by
 * vite.config.ts (short Git SHA, or "unknown" when no checkout is available).
 * They are public, non-secret values whose only purpose is to let a person look
 * at a running build — UI footer or console — and know which commit it is.
 *
 * The runtime mode answers "where does data live?" explicitly:
 *  - `cloud`: Supabase env present → Supabase is the source of truth.
 *  - `demo`:  no Supabase env → local demo mode, data lives in this browser only.
 * A production bundle in `demo` mode is a misconfiguration (`productionLike`
 * is true) and must be surfaced loudly, never look like a healthy cloud build.
 */
import { isSupabaseConfigured } from "./supabase/client";

export type RuntimeMode = "cloud" | "demo";

export interface BuildInfo {
  sha: string;
  builtAt: string;
  mode: RuntimeMode;
  /** True for a production bundle (import.meta.env.PROD). */
  productionBuild: boolean;
  /** A production bundle running WITHOUT Supabase configuration. */
  misconfigured: boolean;
}

function envString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export function getBuildInfo(): BuildInfo {
  const productionBuild = Boolean(import.meta.env.PROD);
  const mode: RuntimeMode = isSupabaseConfigured() ? "cloud" : "demo";
  return {
    sha: envString(import.meta.env.VITE_BUILD_SHA, "unknown"),
    builtAt: envString(import.meta.env.VITE_BUILD_TIME, "unknown"),
    mode,
    productionBuild,
    misconfigured: productionBuild && mode === "demo",
  };
}

/** Short human label for the footer, e.g. "build a1b2c3d · cloud". */
export function buildLabel(info: BuildInfo = getBuildInfo()): string {
  return `build ${info.sha} · ${info.mode}`;
}

let logged = false;
/** Logs the build identity once per page load (console is the observable channel). */
export function logBuildInfo(info: BuildInfo = getBuildInfo()): void {
  if (logged || typeof window === "undefined") return;
  logged = true;
  const level = info.misconfigured ? "warn" : "info";
  console[level](
    `[elenas-plate] build=${info.sha} builtAt=${info.builtAt} mode=${info.mode}` +
      (info.misconfigured ? " — PRODUCTION BUILD WITHOUT SUPABASE CONFIGURATION" : ""),
  );
  // Also expose on window so a person can inspect it from devtools / Playwright.
  (window as unknown as { __ELENAS_PLATE_BUILD__?: BuildInfo }).__ELENAS_PLATE_BUILD__ = info;
}
