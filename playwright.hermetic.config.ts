import { defineConfig, devices } from "@playwright/test";

/**
 * Hermetic browser tests (M1 Tier 2, docs/NO_LOCAL_DOCKER_POLICY.md): the real
 * app in local demo mode with NO backend. `--mode hermetic` makes vite.config.ts
 * blank the two public Supabase vars, so these tests can never reach production
 * (or any Supabase project) regardless of what `.env*` files exist locally.
 * No containers are involved.
 *
 * Run: `npm run e2e:hermetic`
 */
const PORT = 4332;

export default defineConfig({
  testDir: "./e2e/hermetic",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "he-IL",
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx vite dev --mode hermetic --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
