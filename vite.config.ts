// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { execSync } from "node:child_process";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin, ResolvedConfig } from "vite";

/**
 * Build identity (M1 Phase A). A non-secret short Git SHA is baked into the
 * bundle so the running app can say which commit it is. Resolution order:
 *  1. `VITE_BUILD_SHA` supplied by the build environment (CI / Lovable env);
 *  2. `git rev-parse --short HEAD` when a git checkout is available;
 *  3. "unknown" — never throws, so a build without git still succeeds.
 */
function resolveBuildSha(): string {
  const fromEnv = process.env.VITE_BUILD_SHA?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

/**
 * `--mode hermetic` (or `ELENAS_PLATE_HERMETIC=1`) forces local demo mode
 * regardless of any `.env*` file on the machine, so browser tests can run with
 * no backend and can never touch production by accident. Only the two public
 * Supabase vars are cleared. (Detected from argv/env because the Lovable
 * wrapper's options form does not receive the Vite mode.)
 */
function isHermeticMode(): boolean {
  if (process.env.ELENAS_PLATE_HERMETIC === "1") return true;
  const argv = process.argv;
  const i = argv.indexOf("--mode");
  if (i >= 0 && argv[i + 1] === "hermetic") return true;
  return argv.includes("--mode=hermetic") || argv.includes("-m=hermetic");
}

const hermetic = isHermeticMode();
const buildSha = resolveBuildSha();
const buildTime = new Date().toISOString();

/** Hostname of a Supabase URL, or "" — never the key, never the full URL with params. */
function supabaseHost(url: string | undefined): string {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return "";
  }
}

/**
 * Emits `build-info.json` next to the client assets (served at `/build-info.json`).
 * It is the artifact-level, non-secret statement of what this build IS:
 * commit, time, runtime mode (cloud/demo), declared target (shared/demo) and
 * the Supabase host it was compiled against. `scripts/release-preflight.ts`
 * reads it from a local build or from the live URL, so "which build is
 * published and is it connected?" is answered by a file, not by a person.
 * Added after DEC-024 (a published build had silently shipped without any
 * Supabase configuration). Mirrors `src/lib/build-info.ts`.
 */
function buildInfoManifestPlugin(): Plugin {
  let resolved: ResolvedConfig;
  return {
    name: "elenas-plate:build-info-manifest",
    apply: "build",
    configResolved(config) {
      resolved = config;
    },
    generateBundle() {
      // Only the browser bundle gets the manifest (not the SSR / nitro server builds).
      const envName = (this as { environment?: { name?: string } }).environment?.name;
      const isClient = envName ? envName === "client" : !resolved.build.ssr;
      if (!isClient) return;

      const env = resolved.env as Record<string, string | undefined>;
      const url = hermetic ? "" : (env.VITE_SUPABASE_URL ?? "").trim();
      const key = hermetic
        ? ""
        : (env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
      const rawTarget = (env.VITE_RUNTIME_TARGET ?? "").trim().toLowerCase();
      const target = rawTarget === "shared" || rawTarget === "demo" ? rawTarget : "shared";
      const mode = url && key ? "cloud" : "demo";
      const manifest = {
        sha: buildSha,
        builtAt: buildTime,
        mode,
        target,
        targetExplicit: rawTarget === "shared" || rawTarget === "demo",
        supabaseHost: supabaseHost(url),
        productionBuild: true,
        hermetic,
        misconfigured: target === "shared" && mode === "demo",
      };
      this.emitFile({
        type: "asset",
        fileName: "build-info.json",
        source: JSON.stringify(manifest, null, 2) + "\n",
      });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [buildInfoManifestPlugin()],
    define: {
      "import.meta.env.VITE_BUILD_SHA": JSON.stringify(buildSha),
      "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildTime),
      ...(hermetic
        ? {
            "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
            "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(""),
            "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(""),
          }
        : {}),
    },
  },
});
