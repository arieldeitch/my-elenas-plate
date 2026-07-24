import { test, expect } from "@playwright/test";
import { signIn, uniqueEmail, waitForApp } from "./helpers";

test("sign in, bootstrap, RTL, profiles and six meal slots", async ({ page }) => {
  await signIn(page, uniqueEmail());

  // RTL document
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");

  // Both profiles (bootstrap created אריאל + אלנה); never "אני"
  await expect(page.getByRole("tab", { name: /אריאל/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /אלנה/ })).toBeVisible();
  await expect(page.getByText("אני", { exact: true })).toHaveCount(0);

  // Exactly the six current meal slots, no "ארוחת לילה"
  for (const label of [
    "פתיחת חלון אכילה",
    "נשנוש ראשון",
    "ארוחה מרכזית",
    "נשנוש אחר הצהריים",
    "ארוחת ערב",
    "ארוחה נוספת",
  ]) {
    await expect(page.getByRole("button", { name: new RegExp(`^${label}:`) })).toBeVisible();
  }
  await expect(page.getByText("ארוחת לילה")).toHaveCount(0);
});

test("mobile viewport has no horizontal overflow", async ({ page }) => {
  await signIn(page, uniqueEmail());
  await waitForApp(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
