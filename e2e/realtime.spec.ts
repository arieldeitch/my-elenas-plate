import { test, expect } from "@playwright/test";
import { addSearchedFood, closeDialog, openApp, waitLive, waitSaved } from "./helpers";

test("realtime: a second browser context reflects a change to the shared account", async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await openApp(pageA); // device A: fresh anonymous session, joins the household

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await openApp(pageB); // device B: its own anonymous session, same household
  // Let B's realtime subscription establish before A mutates — postgres_changes
  // does not replay events that occurred before SUBSCRIBED.
  await waitSaved(pageB);
  await waitLive(pageB);

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
