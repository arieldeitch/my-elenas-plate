import { test, expect } from "@playwright/test";
import { waitForHydration } from "./helpers";

/**
 * M2-4 — Day Review, hermetic. Home → one tap → understand today's food →
 * inspect the partner → fix my own item → return, with the home showing the
 * updated truth. Skipped vs empty stays accurate; nothing changes person or
 * date by merely looking.
 */
async function logFood(page: import("@playwright/test").Page, slot: string, food: string) {
  await page.getByRole("button", { name: new RegExp(`^${slot}:`) }).click();
  await page.getByLabel("חיפוש מאכל").fill(food);
  // M2-6: a result with a usual quantity adds on tap; otherwise confirm the quantity screen.
  const result = page.getByTestId("search-result").filter({ hasText: food }).first();
  const direct = (await result.getAttribute("data-direct")) === "true";
  await result.click();
  if (!direct) await page.getByRole("button", { name: "הוספת המאכל" }).click();
  await page.getByRole("button", { name: "סיום" }).click();
}

test("one tap from home shows the whole day, the partner's day, and reaches editing", async ({
  page,
}) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("dialog").getByRole("button", { name: /אלנה/ }).click();

  // Elena logs two things in one slot, one elsewhere, and skips a snack.
  await logFood(page, "פתיחת חלון אכילה", "ביצה");
  await logFood(page, "פתיחת חלון אכילה", "תפוח");
  await logFood(page, "ארוחת ערב", "סלמון");
  await page.getByRole("button", { name: /^נשנוש ראשון:/ }).click();
  await page.getByRole("button", { name: "לא נאכלה ארוחה" }).click();
  await page.getByRole("button", { name: "סגירה" }).click();

  // One tap on the today card → the review of MY day for today.
  await page.getByTestId("today-review").click();
  const review = page.getByTestId("day-review");
  await expect(review).toHaveAttribute("data-person", "elena");
  await expect(page.getByTestId("day-review-summary")).toContainText("3/6 ארוחות תועדו · 3 פריטים");
  const breakfast = page.getByTestId("day-review-slot-breakfast");
  await expect(breakfast).toHaveAttribute("data-status", "logged");
  await expect(breakfast).toContainText("ביצה");
  await expect(breakfast).toContainText("תפוח");
  await expect(breakfast.getByText(/^\d{2}:\d{2}$/)).toHaveCount(2);
  await expect(page.getByTestId("day-review-slot-morning_snack")).toHaveAttribute(
    "data-status",
    "skipped",
  );
  await expect(page.getByTestId("day-review-slot-morning_snack")).toContainText("לא נאכלה ארוחה");
  await expect(page.getByTestId("day-review-slot-lunch")).toHaveAttribute("data-status", "empty");
  await expect(page.getByTestId("day-review-slot-dinner")).toContainText("סלמון");
  // No horizontal overflow inside the sheet.
  const overflow = await review.evaluate((el) => {
    const list = el.querySelector("[data-testid='day-review-list']") as HTMLElement;
    return list.scrollWidth > list.clientWidth;
  });
  expect(overflow).toBe(false);

  // The partner (Ariel): read-only, empty today; looking does not switch.
  await review.getByRole("tab", { name: /אריאל/ }).click();
  await expect(review).toHaveAttribute("data-person", "me");
  await expect(page.getByText("אריאל עוד לא תיעד כלום ליום הזה.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^עריכת/ })).toHaveCount(0);
  await review.getByRole("tab", { name: /שלי/ }).click();
  await expect(review).toHaveAttribute("data-person", "elena");

  // Fix my own item: edit shortcut → the meal editor for that slot, as me → delete the apple.
  await page.getByRole("button", { name: "עריכת פתיחת חלון אכילה" }).click();
  await expect(review).toHaveCount(0);
  const editor = page.getByRole("dialog", { name: "פתיחת חלון אכילה · אלנה" });
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "מחיקה" }).nth(1).click();
  await page.getByRole("button", { name: "סיום" }).click();

  // Back home: the truth is updated everywhere without any navigation.
  await expect(page.getByTestId("today-count")).toContainText("3/6");
  await page.getByTestId("today-review").click();
  await expect(page.getByTestId("day-review-summary")).toContainText("2 פריטים");
  await expect(page.getByTestId("day-review-slot-breakfast")).not.toContainText("תפוח");
  await page.getByRole("button", { name: "סגירה" }).click();

  // The partner card opens the partner's review directly (read-only), with the
  // explicit switch at the bottom; person and date are untouched by looking.
  await page.getByTestId("partner-glance").click();
  await expect(page.getByTestId("day-review")).toHaveAttribute("data-person", "me");
  await expect(page.getByTestId("day-review-switch")).toBeVisible();
  await page.getByRole("button", { name: "סגירה" }).click();
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-owner", "elena");
  await expect(page.getByTestId("today-card")).toContainText("היום");
});
