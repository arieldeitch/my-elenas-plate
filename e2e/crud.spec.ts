import { test, expect } from "@playwright/test";
import {
  PASSWORD,
  addSearchedFood,
  closeDialog,
  openMeal,
  signIn,
  uniqueEmail,
  waitForApp,
  waitSaved,
} from "./helpers";

test("meal + coffee CRUD persist across refresh", async ({ page }) => {
  await signIn(page, uniqueEmail());

  // A fresh cloud account starts empty (no demo-seed pollution).
  await addSearchedFood(page, "ארוחת ערב", "תפוח");
  await closeDialog(page);
  await expect(page.getByRole("button", { name: "ארוחת ערב: תועד" })).toBeVisible();

  // Coffee via the fast path
  await openMeal(page, "נשנוש אחר הצהריים");
  await page.getByRole("button", { name: "הוספת מאכל" }).first().click();
  await page.getByRole("button", { name: /הוספת קפה מהירה/ }).click();
  await page.getByRole("button", { name: "הוספת הקפה" }).click();
  await page.getByRole("button", { name: "חזרה לארוחה" }).click();
  await expect(page.getByText(/אמריקנו · ללא חלב/)).toBeVisible();
  await closeDialog(page);
  await waitSaved(page);

  // Refresh — session persists; data hydrates from Supabase
  await page.reload();
  await waitForApp(page);

  // Open the meal and verify the entry hydrated from the cloud, then delete it
  await openMeal(page, "ארוחת ערב");
  await expect(page.getByText("תפוח")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "מחיקה" }).click();
  await expect(page.getByText("עוד לא תועדו מאכלים בארוחה הזו.")).toBeVisible();
});

test("custom food, favorites and recents", async ({ page }) => {
  await signIn(page, uniqueEmail());

  await openMeal(page, "ארוחה מרכזית");
  await page.getByRole("button", { name: "הוספת מאכל" }).first().click();
  await page.getByLabel("חיפוש מאכל").fill("מאכל בדיקה");
  await page.getByRole("button", { name: /כמאכל חדש/ }).click(); // create custom food
  await page.getByRole("button", { name: "הוספת המאכל" }).click();
  await page.getByRole("button", { name: "חזרה לארוחה" }).click();
  await expect(page.getByText("מאכל בדיקה")).toBeVisible();

  // Favorite it
  await page.getByRole("button", { name: "הוספה למועדפים" }).first().click();
  await closeDialog(page);
  await waitSaved(page);

  // Refresh — custom food + favorite + recent hydrate from Supabase
  await page.reload();
  await waitForApp(page);
  await openMeal(page, "ארוחה מרכזית");
  await page.getByRole("button", { name: "הוספת מאכל" }).first().click();
  // appears under favorites/recents in the search view
  await expect(page.getByText("מאכל בדיקה").first()).toBeVisible();
});

test("fasting, workout and weigh-in persist", async ({ page }) => {
  await signIn(page, uniqueEmail());

  // Fasting 20:00 → 12:00 = 16h (crosses midnight)
  await page.getByRole("button", { name: "הוספת שעות" }).click();
  await page.getByLabel("תחילת הצום").fill("20:00");
  await page.getByLabel("סיום הצום").fill("12:00");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByText("16 שעות")).toBeVisible();

  // Workout performed
  await page.getByRole("button", { name: "כן", exact: true }).click();
  await expect(page.getByText("סוג האימון")).toBeVisible();

  // Weigh-in
  await page.getByRole("button", { name: "פתיחת טופס שקילה" }).click();
  await page.getByLabel("משקל בק״ג").fill("80");
  await page.getByRole("button", { name: "שמירת השקילה" }).click();
  await expect(page.getByText(/80 ק״ג/)).toBeVisible();
  await waitSaved(page);

  await page.reload();
  await waitForApp(page);
  await expect(page.getByText("16 שעות")).toBeVisible();
  await expect(page.getByText(/80 ק״ג/)).toBeVisible();
});

test("profile switching keeps data separate", async ({ page }) => {
  await signIn(page, uniqueEmail());
  await addSearchedFood(page, "ארוחת ערב", "תפוח");
  await closeDialog(page);
  await expect(page.getByRole("button", { name: "ארוחת ערב: תועד" })).toBeVisible();
  await waitSaved(page); // ensure the push flushed before switching (switch re-hydrates)

  await page.getByRole("tab", { name: /אלנה/ }).click();
  await expect(page.getByRole("button", { name: "ארוחת ערב: לא תועד" })).toBeVisible();

  await page.getByRole("tab", { name: /אריאל/ }).click();
  await expect(page.getByRole("button", { name: "ארוחת ערב: תועד" })).toBeVisible();
});

test("session lifecycle: clear session then re-login restores cloud data", async ({
  page,
  context,
}) => {
  const email = uniqueEmail();
  await signIn(page, email);
  await addSearchedFood(page, "ארוחת ערב", "תפוח");
  await closeDialog(page);
  await waitSaved(page);

  // "Sign out": drop the session, reload → back to the sign-in gate
  await context.clearCookies();
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByRole("button", { name: "סיסמה" })).toBeVisible({ timeout: 30_000 });

  // Re-login with the same account → cloud data returns
  await page.getByRole("button", { name: "סיסמה" }).click();
  await page.getByLabel("אימייל").fill(email);
  await page.getByLabel("סיסמה").fill(PASSWORD);
  await page.getByRole("button", { name: "כניסה" }).click();
  await waitForApp(page);
  await expect(page.getByRole("button", { name: "ארוחת ערב: תועד" })).toBeVisible();
});
