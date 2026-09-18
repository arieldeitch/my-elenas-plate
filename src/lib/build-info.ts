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
 *
 * The runtime TARGET answers "what was this build meant to be?" and is the
 * fail-safe added after the 2026-09-18 finding (DEC-024): the published couple
 * app had been built with no Supabase env and silently ran in demo mode.
 *  - `VITE_RUNTIME_TARGET=shared` (the default for every production bundle):
 *    Supabase configuration is REQUIRED. Without it the build is
 *    `misconfigured` and RuntimeGate refuses to mount the app, so nothing can
 *    be written into an isolated local-only reality.
 *  - `VITE_RUNTIME_TARGET=demo`: a deliberate demo build (dev servers, the
 *    hermetic tests, or an intentionally published demo). Demo mode is allowed
 *    and clearly labelled.
 * Development bundles default to `demo` so `vite dev` without `.env` keeps
 * working; a production bundle can only be a demo by saying so explicitly.
 */
import { isSupabaseConfigured } from "./supabase/client";

export type RuntimeMode = "cloud" | "demo";
export type RuntimeTarget = "shared" | "demo";

export interface BuildInfo {
  sha: string;
  builtAt: string;
  mode: RuntimeMode;
  /** What the build was declared to be (explicit env, or the mode default). */
  target: RuntimeTarget;
  /** True when `VITE_RUNTIME_TARGET` was set explicitly at build time. */
  targetExplicit: boolean;
  /** True for a production bundle (import.meta.env.PROD). */
  productionBuild: boolean;
  /**
   * A build that REQUIRES the shared cloud but has no Supabase configuration.
   * RuntimeGate blocks the whole app in this state; it must never look like a
   * healthy cloud build and must never persist anything locally.
   */
  misconfigured: boolean;
}

function envString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function readTarget(productionBuild: boolean): { target: RuntimeTarget; explicit: boolean } {
  const raw = envString(import.meta.env.VITE_RUNTIME_TARGET, "").toLowerCase();
  if (raw === "shared" || raw === "demo") return { target: raw, explicit: true };
  // Unknown values are treated as unset — and an unset target in production
  // means "shared", because that is the only thing the couple app is for.
  return { target: productionBuild ? "shared" : "demo", explicit: false };
}

export function getBuildInfo(): BuildInfo {
  const productionBuild = Boolean(import.meta.env.PROD);
  const mode: RuntimeMode = isSupabaseConfigured() ? "cloud" : "demo";
  const { target, explicit } = readTarget(productionBuild);
  return {
    sha: envString(import.meta.env.VITE_BUILD_SHA, "unknown"),
    builtAt: envString(import.meta.env.VITE_BUILD_TIME, "unknown"),
    mode,
    target,
    targetExplicit: explicit,
    productionBuild,
    misconfigured: target === "shared" && mode === "demo",
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
  const level = info.misconfigured ? "error" : "info";
  console[level](
    `[elenas-plate] build=${info.sha} builtAt=${info.builtAt} mode=${info.mode} target=${info.target}` +
      (info.misconfigured ? " — SHARED BUILD WITHOUT SUPABASE CONFIGURATION (app blocked)" : ""),
  );
  // Also expose on window so a person can inspect it from devtools / Playwright.
  (window as unknown as { __ELENAS_PLATE_BUILD__?: BuildInfo }).__ELENAS_PLATE_BUILD__ = info;
}
