import { test, expect } from "@playwright/test";
import { waitForHydration } from "./helpers";

/**
 * M2-5 — "I added 1 egg, I need 2, tap + once." Quick add → the new row is
 * highlighted with − / + right there → one tap → finish → the Day Review
 * shows the corrected quantity. No quantity screen involved.
 */
test("quick add, one tap on +, finish — the day review shows 2 units", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("dialog").getByRole("button", { name: /אלנה/ }).click();

  // First time through search: a typed result opens the quantity choice (vegetables 0,
  // an egg 2 points); confirming with the default 1 unit makes the egg a recent chip.
  await page.getByRole("button", { name: /^פתיחת חלון אכילה:/ }).click();
  await page.getByLabel("חיפוש מאכל").fill("ביצה קשה");
  // DEC-036: "ביצה קשה" is a verified alias; the ONE card is the reference food ביצה (1 יחידה = 2).
  const result = page
    .getByTestId("search-result")
    .filter({ hasText: "נמצא לפי: ביצה קשה" })
    .first();
  await expect(result).toContainText("בחירת כמות");
  await result.click();
  await expect(page.getByTestId("points-preview")).toHaveAttribute("data-points", "2");
  // Subjective tab: the visible labels and instant preview; back to measured leaves no leak.
  await page.getByRole("tab", { name: "לפי תחושה" }).click();
  await page.getByRole("button", { name: "יותר מדי" }).click();
  await expect(page.getByTestId("points-preview")).toHaveAttribute("data-points", "3");
  await page.getByRole("tab", { name: "מדידה" }).click();
  await expect(page.getByTestId("points-preview")).toHaveAttribute("data-points", "2");
  await page.getByRole("button", { name: "הוספת המאכל" }).click();
  await expect(page.getByTestId("meal-entry").first()).toHaveAttribute("data-quantity", "1 יחידה");
  await page.getByRole("button", { name: "סיום" }).click();

  // The common case: tile → chip (quick add) → + → סיום.
  await page.getByRole("button", { name: /^ארוחה מרכזית:/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ביצה, הוספה של 1 יחידה" }).click();
  const row = page.getByTestId("meal-entry").last();
  await expect(row).toHaveAttribute("data-quantity", "1 יחידה");
  await expect(row.getByRole("button", { name: "פחות ביצה" })).toBeDisabled();
  await row.getByRole("button", { name: "עוד ביצה" }).click();
  await expect(row).toHaveAttribute("data-quantity", "2 יחידות");
  await expect(row.getByTestId("qty-value")).toHaveText("2 יחידות");
  // No quantity screen appeared.
  await expect(page.getByRole("button", { name: "הוספת המאכל" })).toHaveCount(0);
  // No horizontal overflow in the row.
  expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
  await page.getByRole("button", { name: "סיום" }).click();

  // The review reflects the corrected quantity; it has no steppers of its own.
  await page.getByTestId("today-review").click();
  const lunch = page.getByTestId("day-review-slot-lunch");
  await expect(lunch).toContainText("ביצה");
  await expect(lunch).toContainText("2 יחידות");
  await expect(page.getByTestId("day-review").getByTestId("qty-plus")).toHaveCount(0);
  await page.getByRole("button", { name: "סגירה" }).click();

  // Reload keeps the corrected quantity.
  await page.reload();
  await waitForHydration(page);
  await page.getByTestId("today-review").click();
  await expect(page.getByTestId("day-review-slot-lunch")).toContainText("2 יחידות");
});
