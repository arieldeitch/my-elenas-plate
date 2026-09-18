import { test, expect } from "@playwright/test";
import { addSearchedFood, closeDialog, openMeal, openApp, waitForApp, waitSaved } from "./helpers";

test("meal + coffee CRUD persist across refresh", async ({ page }) => {
  await openApp(page);

  // A fresh cloud account starts empty (no demo-seed pollution).
  await addSearchedFood(page, "ארוחת ערב", "תפוח");
  await closeDialog(page);
  await expect(page.getByRole("button", { name: "ארוחת ערב: תועד" })).toBeVisible();

  // Coffee via the fast path
  await openMeal(page, "נשנוש אחר הצהריים");
  await page.getByRole("button", { name: /הוספת קפה מהירה/ }).click();
  await page.getByRole("button", { name: "הוספת הקפה" }).click();
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
  await expect(page.getByTestId("meal-entries")).toHaveCount(0);
});

test("custom food, favorites and recents", async ({ page }) => {
  await openApp(page);

  await openMeal(page, "ארוחה מרכזית");
  await page.getByLabel("חיפוש מאכל").fill("מאכל בדיקה");
  await page.getByRole("button", { name: /כמאכל חדש/ }).click(); // create custom food
  await page.getByRole("button", { name: "הוספת המאכל" }).click();
  await expect(page.getByTestId("meal-entries").getByText("מאכל בדיקה")).toBeVisible();

  // Favorite it
  await page.getByRole("button", { name: "הוספה למועדפים" }).first().click();
  await closeDialog(page);
  await waitSaved(page);

  // Refresh — custom food + favorite + recent hydrate from Supabase
  await page.reload();
  await waitForApp(page);
  await openMeal(page, "ארוחה מרכזית");
  // appears under favorites/recents in the search view (entries hydrate too)
  await expect(page.getByText("מאכל בדיקה").first()).toBeVisible();
});

test("built-in food favorite + recent sync (text food_id) per profile", async ({ page }) => {
  await openApp(page);

  // Add + favorite a BUILT-IN catalog food (string id like f_apple) for אריאל.
  await addSearchedFood(page, "ארוחה מרכזית", "תפוח");
  await page.getByRole("button", { name: "הוספה למועדפים" }).first().click();
  await closeDialog(page);
  await waitSaved(page);

  // Refresh — the favorite + recent hydrate from Supabase (food_preferences).
  await page.reload();
  await waitForApp(page);
  await openMeal(page, "נשנוש ראשון");
  // The built-in food is listed (favorites section) for אריאל after hydrate.
  await expect(page.getByRole("button", { name: /תפוח/ }).first()).toBeVisible({ timeout: 30_000 });
  await closeDialog(page);

  // אלנה must NOT inherit אריאל's favorite/recent (per-profile separation).
  await page.getByRole("tab", { name: /אלנה/ }).click();
  await openMeal(page, "נשנוש ראשון");
  await expect(page.getByRole("button", { name: /תפוח/ })).toHaveCount(0);
});

test("fasting, workout and weigh-in persist", async ({ page }) => {
  await openApp(page);

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
  await openApp(page);
  await addSearchedFood(page, "ארוחת ערב", "תפוח");
  await closeDialog(page);
  await expect(page.getByRole("button", { name: "ארוחת ערב: תועד" })).toBeVisible();
  await waitSaved(page); // ensure the push flushed before switching (switch re-hydrates)

  await page.getByRole("tab", { name: /אלנה/ }).click();
  await expect(page.getByRole("button", { name: "ארוחת ערב: לא תועד" })).toBeVisible();

  await page.getByRole("tab", { name: /אריאל/ }).click();
  await expect(page.getByRole("button", { name: "ארוחת ערב: תועד" })).toBeVisible();
});

test("session loss: cleared storage → fresh device identity rejoins and the cloud data returns (DEC-031)", async ({
  page,
  context,
}) => {
  await openApp(page);
  await addSearchedFood(page, "ארוחת ערב", "תפוח");
  await closeDialog(page);
  await waitSaved(page);

  // Storage cleared: the anonymous session is gone for good (not recoverable by design).
  await context.clearCookies();
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  // No form: a new silent session joins the same household; the device is asked
  // who uses it once more, then the day is hydrated from the cloud.
  await waitForApp(page);
  await expect(page.getByLabel("אימייל")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ארוחת ערב: תועד" })).toBeVisible();
});
