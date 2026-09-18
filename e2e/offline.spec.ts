import { test, expect } from "@playwright/test";
import {
  addSearchedFood,
  closeDialog,
  openMeal,
  signIn,
  uniqueEmail,
  waitForApp,
  waitSaved,
} from "./helpers";

const SUPABASE_HOST = /supabase\.(co|in)|127\.0\.0\.1:54321/;

/**
 * M1 Test 5 — offline + reload + reconnect (real backend: hosted test branch).
 *
 * "Offline" is simulated by aborting every request to the Supabase host rather
 * than `context.setOffline(true)`, because a full offline context cannot
 * reload the page from the dev server — and reloading while the mutation is
 * still unsent is exactly what this test must prove. The app classifies the
 * aborted fetch as a network failure, keeps the op in the durable queue, and
 * retries until the route is restored.
 */
test("offline mutation survives a reload, then syncs exactly once on reconnect", async ({
  page,
  context,
}) => {
  await signIn(page, uniqueEmail());
  // Let bootstrap + initial hydrate settle so the mutation is made against a
  // fully active sync (not an in-flight activation).
  await waitSaved(page);
  await page.waitForTimeout(2000);

  // Cut Supabase, then log a food — the UI updates optimistically and the op
  // is persisted locally (not "saved").
  await context.route(SUPABASE_HOST, (route) => route.abort("internetdisconnected"));
  await addSearchedFood(page, "ארוחת ערב", "תפוח");
  await closeDialog(page);
  await expect(page.getByRole("button", { name: "ארוחת ערב: תועד" })).toBeVisible();
  await expect(page.locator("[data-sync-state='saved']")).toHaveCount(0);
  const queued = await page.evaluate(() => window.localStorage.getItem("elenas-plate:queue:v2"));
  expect(queued).toBeTruthy();
  expect(JSON.parse(queued!).length).toBeGreaterThan(0);

  // Reload while still cut off: the session and the queue survive; still unsent.
  await page.reload();
  await waitForApp(page);
  await expect(page.locator("[data-sync-state='saved']")).toHaveCount(0);

  // Reconnect — the durable queue drains; "saved" means Supabase confirmed it.
  await context.unroute(SUPABASE_HOST);
  await waitSaved(page);
  const after = await page.evaluate(() => window.localStorage.getItem("elenas-plate:queue:v2"));
  expect(JSON.parse(after ?? "[]")).toHaveLength(0);

  // Fresh reload: the entry comes from Supabase, exactly once.
  await page.reload();
  await waitForApp(page);
  await openMeal(page, "ארוחת ערב");
  await expect(page.getByText("תפוח")).toHaveCount(1, { timeout: 30_000 });
});
