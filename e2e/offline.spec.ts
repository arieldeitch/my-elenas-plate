import { test, expect } from "@playwright/test";
import { addSearchedFood, closeDialog, openMeal, signIn, uniqueEmail, waitForApp } from "./helpers";

test("offline mutation queues, flushes on reconnect, and does not duplicate", async ({
  page,
  context,
}) => {
  await signIn(page, uniqueEmail());
  // Let bootstrap + initial hydrate settle before dropping the network, so the
  // mutation is made against a fully-active sync (not an in-flight activation).
  await expect(page.getByText("נשמר", { exact: true })).toBeVisible();
  await page.waitForTimeout(2500);

  // Go offline, then log a food — the UI updates optimistically.
  await context.setOffline(true);
  await addSearchedFood(page, "ארוחת ערב", "תפוח");
  await closeDialog(page);
  await expect(page.getByRole("button", { name: "ארוחת ערב: תועד" })).toBeVisible();

  // Reconnect — the queued push flushes (online event or the retry interval).
  // Wait for the "saved" indicator, which means the push actually completed.
  await context.setOffline(false);
  await expect(page.getByText("נשמר", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);

  // Reload: the entry came from Supabase (persisted), exactly once.
  await page.reload();
  await waitForApp(page);
  // Open the meal and verify the entry directly (source of truth), exactly once.
  await openMeal(page, "ארוחת ערב");
  await expect(page.getByText("תפוח")).toHaveCount(1, { timeout: 30_000 });
});
