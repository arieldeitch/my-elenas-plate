import { test, expect } from "@playwright/test";
import { waitForHydration } from "./helpers";

/**
 * DEC-037 acceptance 25 — the dedicated dishes flow on a phone (Pixel 7,
 * hermetic demo store, no backend): set a manual target, build a mixed
 * canonical + label-estimated dish, save its prepared weight, and log a
 * weighed serving into a meal. Nothing may overflow horizontally and the
 * estimated parts must stay visibly marked.
 */
test("manual target, a mixed dish and a logged serving — all on a phone", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("dialog").getByRole("button", { name: /אריאל/ }).click();

  // --- R1: no target is a real state, then a manual 27 -----------------------
  const todayPoints = page.getByTestId("today-points");
  await expect(todayPoints).toHaveAttribute("data-budget-source", "none");
  await expect(todayPoints.getByTestId("budget-setup-prompt")).toHaveText("יעד לא הוגדר");
  await expect(todayPoints).not.toContainText("נשארו");

  await todayPoints.click();
  await page.getByLabel("יעד יומי (נקודות)").fill("27");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(todayPoints).toHaveAttribute("data-budget-source", "manual");
  await expect(todayPoints).toContainText("27");

  // --- R2: the dishes area is a real destination in the bottom navigation ----
  await page.getByRole("navigation").getByRole("button", { name: "תבשילים" }).click();
  await expect(page).toHaveURL(/\/dishes$/);
  await expect(page.getByRole("heading", { name: "תבשילים", level: 2 })).toBeVisible();
  await expect(page.getByTestId("dish-list")).toContainText("עדיין אין תבשילים");

  // --- R3/R7: a dish from a canonical ingredient + a label-estimated one -----
  await page.getByTestId("dish-new").click();
  const editor = page.getByTestId("dish-editor");
  await editor.getByLabel("שם התבשיל").fill("תבשיל בדיקה");

  await editor.getByTestId("dish-add-ingredient").click();
  await page.getByLabel("חיפוש מרכיב").fill("תפוח אדמה");
  await page.getByTestId("ingredient-option").first().click();
  await page.getByLabel("כמות").fill("200");
  await page.getByTestId("ing-add").click();
  await expect(editor.getByTestId("dish-ingredient")).toHaveCount(1);

  // R5 from inside the dish: a product that is not in the reference.
  await editor.getByTestId("dish-add-ingredient").click();
  await page.getByLabel("חיפוש מרכיב").fill("רוטב מיוחד");
  await page.getByTestId("ingredient-create-estimated").click();
  await expect(page.getByTestId("label-estimator-form")).toBeVisible();
  await page.getByLabel(/קלוריות/).fill("300");
  await expect(page.getByTestId("label-estimate-preview")).not.toHaveAttribute(
    "data-points",
    "invalid",
  );
  await page.getByTestId("le-save").click();
  await page.getByLabel("כמות").fill("100");
  await page.getByTestId("ing-add").click();

  const ingredients = editor.getByTestId("dish-ingredient");
  await expect(ingredients).toHaveCount(2);
  await expect(ingredients.nth(1)).toHaveAttribute("data-source", "estimated");
  await expect(ingredients.nth(1)).toContainText("הערכה");

  // --- R8: the prepared weight gives the rate --------------------------------
  await editor.getByLabel("משקל התבשיל המוכן (גרם)").fill("400");
  await editor.getByLabel("מנה רגילה (גרם, לא חובה)").fill("250");
  const totals = editor.getByTestId("dish-totals");
  await expect(totals).toContainText("נק׳ ל-100 גרם");
  await expect(totals).toContainText("התבשיל כולל מרכיב בהערכה");
  await editor.getByTestId("dish-save").click();

  const card = page.getByTestId("dish-card").first();
  await expect(card).toContainText("תבשיל בדיקה");
  await expect(card).toContainText("הערכה");
  await expect(card).toContainText("2 מרכיבים · גרסה 1");

  // --- R8: log a weighed serving into a meal ---------------------------------
  await card.getByTestId("dish-log").click();
  const sheet = page.getByTestId("dish-log-sheet");
  await expect(sheet.getByTestId("dish-usual-serving")).toContainText("250");
  await sheet.getByTestId("dish-usual-serving").click();
  await sheet.getByTestId("dish-weight-weighed").click();
  const preview = sheet.getByTestId("dish-log-preview");
  await expect(preview).toContainText("יתווספו");
  const logged = await preview.getAttribute("data-points");
  await sheet.getByTestId("dish-log-confirm").click();

  // Back on the home screen the serving is in the meal, marked as a dish.
  await page.getByRole("navigation").getByRole("button", { name: "בית" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: /^ארוחה מרכזית:/ }).click();
  const row = page.getByTestId("meal-entry").first();
  await expect(row).toContainText("תבשיל בדיקה");
  await expect(row).toHaveAttribute("data-quantity", "250 גרם");
  await expect(row).toHaveAttribute("data-points", logged!);
  await expect(row.getByTestId("entry-dish")).toContainText("תבשיל");
  await page.getByRole("button", { name: "סיום" }).click();

  // The day total counts it against the manual target.
  await expect(todayPoints).toContainText("27");
  await expect(todayPoints).toContainText("נשארו");

  // Narrow screen: nothing overflows horizontally.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
