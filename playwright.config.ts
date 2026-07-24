import { defineConfig, devices } from "@playwright/test";

/**
 * Browser E2E (T-028) — QA only. Drives the real app (dev server) against the
 * configured remote Supabase project. Requires `.env` with VITE_SUPABASE_URL +
 * VITE_SUPABASE_ANON_KEY, and a project that accepts the test email domain with
 * "Confirm email" disabled. Sequential + single worker to avoid remote
 * rate-limit / realtime contention.
 */
const PORT = 4330;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "he-IL",
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // `--mode e2e` loads `.env.e2e` when present (point it at a local Supabase
    // stack for reliable runs); otherwise it falls back to `.env` (remote).
    command: `npx vite dev --mode e2e --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
