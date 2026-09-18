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

  // First time through search: the result adds directly (M2-6) and makes the egg a recent chip.
  await page.getByRole("button", { name: /^פתיחת חלון אכילה:/ }).click();
  await page.getByLabel("חיפוש מאכל").fill("ביצה קשה");
  const result = page.getByTestId("search-result").filter({ hasText: "ביצה קשה" }).first();
  await expect(result).toContainText("1 יחידה");
  await result.click();
  await expect(page.getByTestId("meal-entry").first()).toHaveAttribute("data-quantity", "1 יחידה");
  await page.getByRole("button", { name: "סיום" }).click();

  // The common case: tile → chip (quick add) → + → סיום.
  await page.getByRole("button", { name: /^ארוחה מרכזית:/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "ביצה קשה, הוספה של 1 יחידה" })
    .click();
  const row = page.getByTestId("meal-entry").last();
  await expect(row).toHaveAttribute("data-quantity", "1 יחידה");
  await expect(row.getByRole("button", { name: "פחות ביצה קשה" })).toBeDisabled();
  await row.getByRole("button", { name: "עוד ביצה קשה" }).click();
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
  await expect(lunch).toContainText("ביצה קשה");
  await expect(lunch).toContainText("2 יחידות");
  await expect(page.getByTestId("day-review").getByTestId("qty-plus")).toHaveCount(0);
  await page.getByRole("button", { name: "סגירה" }).click();

  // Reload keeps the corrected quantity.
  await page.reload();
  await waitForHydration(page);
  await page.getByTestId("today-review").click();
  await expect(page.getByTestId("day-review-slot-lunch")).toContainText("2 יחידות");
});
