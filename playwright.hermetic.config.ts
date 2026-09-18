import { defineConfig, devices } from "@playwright/test";

/**
 * Hermetic browser tests (M1 Tier 2, docs/NO_LOCAL_DOCKER_POLICY.md): the real
 * app in local demo mode with NO backend. `--mode hermetic` makes vite.config.ts
 * blank the two public Supabase vars, so these tests can never reach production
 * (or any Supabase project) regardless of what `.env*` files exist locally.
 * No containers are involved.
 *
 * Two servers, two projects:
 *  - `mobile-chrome` (port 4332): deliberate demo mode (dev default) — the
 *    device-profile and runtime-mode specs.
 *  - `misconfigured-shared` (port 4334): `VITE_RUNTIME_TARGET=shared` with no
 *    Supabase env — the DEC-024 regression: the app must refuse to run.
 *
 * Run: `npm run e2e:hermetic`
 */
const DEMO_PORT = 4332;
const SHARED_PORT = 4334;

export default defineConfig({
  testDir: "./e2e/hermetic",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    locale: "he-IL",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chrome",
      testIgnore: /misconfigured-shared/,
      use: { ...devices["Pixel 7"], baseURL: `http://localhost:${DEMO_PORT}` },
    },
    {
      name: "misconfigured-shared",
      testMatch: /misconfigured-shared/,
      use: { ...devices["Pixel 7"], baseURL: `http://localhost:${SHARED_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx vite dev --mode hermetic --port ${DEMO_PORT}`,
      url: `http://localhost:${DEMO_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx vite dev --mode hermetic --port ${SHARED_PORT}`,
      url: `http://localhost:${SHARED_PORT}`,
      env: { VITE_RUNTIME_TARGET: "shared" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
