import { test, expect } from "@playwright/test";
import { waitForHydration } from "./helpers";

/**
 * DEC-024 regression — the exact live defect of 2026-09-18: a build meant to be
 * the shared couple app (target=shared) that has NO Supabase configuration.
 * Served by the `misconfigured-shared` web server of playwright.hermetic.config.ts
 * (`VITE_RUNTIME_TARGET=shared`, hermetic env). The app must refuse to run —
 * a full-screen block page, no tracker, no localStorage writes, no Supabase
 * traffic — and the server-rendered HTML must already say so.
 */
test("a shared build without Supabase config is blocked, server-side and client-side", async ({
  page,
  request,
}) => {
  // 1. The HTML alone (what a curl-based preflight sees) carries the marker.
  const html = await (await request.get("/")).text();
  expect(html).toContain('data-runtime-mode="misconfigured"');

  const supabaseRequests: string[] = [];
  page.on("request", (req) => {
    if (/supabase\.(co|in)|127\.0\.0\.1:54321/.test(req.url())) supabaseRequests.push(req.url());
  });

  await page.goto("/");
  await waitForHydration(page);

  // 2. The block page, with build identity, is the only thing rendered.
  const gate = page.locator("[data-runtime-mode='misconfigured']");
  await expect(gate).toBeVisible();
  await expect(gate).toContainText("אינה מחוברת לענן המשותף");
  await expect(gate).toContainText("VITE_SUPABASE_URL");
  expect(await gate.getAttribute("data-build-sha")).toMatch(/^[0-9a-f]{7,}$/);
  // No tracker UI: no meal grid, no profile switcher, no device chooser.
  await expect(page.getByText("ארוחות היום")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/נשמרים בענן המשותף/)).toHaveCount(0);

  // 3. Runtime truth is consistent and loud.
  const info = await page.evaluate(
    () => (window as unknown as { __ELENAS_PLATE_BUILD__?: unknown }).__ELENAS_PLATE_BUILD__,
  );
  expect(info).toMatchObject({ mode: "demo", target: "shared", misconfigured: true });

  // 4. Nothing was written into an isolated local reality, nothing left for Supabase.
  await page.waitForTimeout(500);
  const stored = await page.evaluate(() => window.localStorage.getItem("elenas-plate:v1"));
  expect(stored).toBeNull();
  expect(supabaseRequests).toEqual([]);
});
