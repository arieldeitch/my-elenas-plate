// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { execSync } from "node:child_process";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

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

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_BUILD_SHA": JSON.stringify(resolveBuildSha()),
      "import.meta.env.VITE_BUILD_TIME": JSON.stringify(new Date().toISOString()),
      ...(hermetic
        ? {
            "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
            "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(""),
          }
        : {}),
    },
  },
});
