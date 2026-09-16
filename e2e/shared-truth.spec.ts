import { test, expect } from "@playwright/test";
import { addSearchedFood, closeDialog, openMeal, signIn, uniqueEmail, waitSaved } from "./helpers";

/**
 * M1 §5 Tests 1, 2 and 4 in the real browser against a REAL backend. Runs only
 * with `.env.e2e` pointing at the isolated hosted Supabase test branch
 * (docs/NO_LOCAL_DOCKER_POLICY.md). Never run against production: it creates
 * accounts and rows.
 */
async function twoDevices(browser: import("@playwright/test").Browser) {
  const email = uniqueEmail();
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await signIn(pageA, email);
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await signIn(pageB, email);
  // Let both realtime subscriptions establish (no replay before SUBSCRIBED).
  await waitSaved(pageA);
  await waitSaved(pageB);
  await pageB.waitForTimeout(3000);
  return { pageA, pageB, close: async () => Promise.all([ctxA.close(), ctxB.close()]) };
}

test("Test 1+2 — stale add/add keeps both entries; unrelated delete keeps the other", async ({
  browser,
}) => {
  const { pageA, pageB, close } = await twoDevices(browser);

  // A adds X. B adds Y from its own state (it may or may not have seen X yet).
  await addSearchedFood(pageA, "ארוחת ערב", "תפוח");
  await closeDialog(pageA);
  await addSearchedFood(pageB, "ארוחת ערב", "מלפפון");
  await closeDialog(pageB);
  await waitSaved(pageA);
  await waitSaved(pageB);

  // Both devices converge on X and Y, exactly once each, without reload.
  for (const page of [pageA, pageB]) {
    await openMeal(page, "ארוחת ערב");
    await expect(page.getByText("תפוח")).toHaveCount(1, { timeout: 45_000 });
    await expect(page.getByText("מלפפון")).toHaveCount(1, { timeout: 45_000 });
    await closeDialog(page);
  }

  // A deletes X. Y must remain on both.
  await openMeal(pageA, "ארוחת ערב");
  await pageA
    .locator("div.rounded-2xl", { hasText: "תפוח" })
    .getByRole("button", { name: "מחיקה" })
    .click();
  await closeDialog(pageA);
  await waitSaved(pageA);
  for (const page of [pageA, pageB]) {
    await openMeal(page, "ארוחת ערב");
    await expect(page.getByText("תפוח")).toHaveCount(0, { timeout: 45_000 });
    await expect(page.getByText("מלפפון")).toHaveCount(1);
    await closeDialog(page);
  }

  // Reload reproduces the authoritative state.
  await pageB.reload();
  await openMeal(pageB, "ארוחת ערב");
  await expect(pageB.getByText("מלפפון")).toHaveCount(1, { timeout: 45_000 });
  await expect(pageB.getByText("תפוח")).toHaveCount(0);
  await close();
});

test("Test 4 — fasting create and clear propagate in real time", async ({ browser }) => {
  const { pageA, pageB, close } = await twoDevices(browser);

  await pageA.getByRole("button", { name: "הוספת שעות" }).click();
  await pageA.getByLabel("תחילת הצום").fill("20:00");
  await pageA.getByLabel("סיום הצום").fill("12:00");
  await pageA.getByRole("button", { name: "שמירה" }).click();
  await waitSaved(pageA);
  await expect(pageB.getByText("16 שעות")).toBeVisible({ timeout: 45_000 });

  await pageA.getByRole("button", { name: "עריכת צום" }).click();
  await pageA.getByRole("button", { name: /ניקוי/ }).click();
  await waitSaved(pageA);
  await expect(pageB.getByText("לא תועד צום ליום זה")).toBeVisible({ timeout: 45_000 });
  await close();
});
