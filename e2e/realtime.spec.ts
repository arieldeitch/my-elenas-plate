import { test, expect } from "@playwright/test";
import { addSearchedFood, closeDialog, signIn, uniqueEmail } from "./helpers";

test("realtime: a second browser context reflects a change to the shared account", async ({
  browser,
}) => {
  const email = uniqueEmail();

  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await signIn(pageA, email); // creates the shared account

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await signIn(pageB, email); // same shared account, second session
  // Let B's realtime subscription establish before A mutates — postgres_changes
  // does not replay events that occurred before SUBSCRIBED.
  await expect(pageB.getByText("נשמר", { exact: true })).toBeVisible();
  await pageB.waitForTimeout(4000);

  // A logs a food in ארוחת ערב
  await addSearchedFood(pageA, "ארוחת ערב", "תפוח");
  await closeDialog(pageA);

  // B reflects it via realtime — no manual reload
  await expect(pageB.getByRole("button", { name: "ארוחת ערב: תועד" })).toBeVisible({
    timeout: 45_000,
  });

  await ctxA.close();
  await ctxB.close();
});
