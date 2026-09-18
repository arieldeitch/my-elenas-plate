import { test, expect } from "@playwright/test";
import { waitForHydration } from "./helpers";

/**
 * M2 daily couple loop, hermetic (demo store, no backend): the home answers
 * "how am I / how is my partner doing, what did we eat last, what is the
 * fastest way to log", and every write lands on the right person — through
 * the fast path, a profile switch, a date change and a reload.
 */
test("log as Elena in a few taps, see it on Ariel's partner card, never mixed up", async ({
  page,
}) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("dialog").getByRole("button", { name: /אלנה/ }).click();

  // ME block names the person and the day; PARTNER block names the other one.
  const today = page.getByTestId("today-card");
  await expect(today).toHaveAttribute("data-owner", "elena");
  await expect(today).toContainText("אלנה");
  await expect(page.getByTestId("partner-glance")).toHaveAttribute("data-partner", "me");

  // Tap 1: the meal tile. The editor opens straight into search, owned by Elena.
  await page.getByRole("button", { name: /^ארוחה מרכזית:/ }).click();
  const dialog = page.getByRole("dialog", { name: "ארוחה מרכזית · אלנה" });
  await expect(dialog).toHaveAttribute("data-owner", "elena");
  await expect(page.getByLabel("חיפוש מאכל")).toBeFocused();

  // Tap 2: the typed result adds directly with its usual quantity (M2-6) — no confirm.
  await page.getByLabel("חיפוש מאכל").fill("סלט ירקות");
  const first = dialog.getByTestId("search-result").first();
  await expect(first).toHaveAttribute("data-direct", "true");
  await expect(first).toContainText("1 קערה");
  await first.click();
  await expect(page.getByTestId("meal-entries").getByText("סלט ירקות")).toBeVisible();
  await expect(page.getByLabel("חיפוש מאכל")).toHaveValue("");
  await expect(page.getByRole("button", { name: "הוספת המאכל" })).toHaveCount(0);

  // Quick add: the recent chip adds the second one in ONE tap (same rule as the result).
  await dialog.getByRole("button", { name: "סלט ירקות, הוספה של 1 קערה" }).click();
  await expect(page.getByTestId("meal-entries").getByText("סלט ירקות")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "הוספת המאכל" })).toHaveCount(0);
  await page.getByRole("button", { name: "סיום" }).click();

  // ME block reflects it; latest activity names the food and the slot.
  await expect(page.getByTestId("today-count")).toContainText("1/6");
  await expect(page.getByTestId("today-latest")).toContainText("לאחרונה: סלט ירקות · ארוחה מרכזית");

  // The partner card opens his Day Review (read-only); switching to Ariel is the
  // explicit step at its bottom. His day is empty, her card shows her food.
  await page.getByTestId("partner-glance").click();
  await expect(page.getByTestId("day-review")).toHaveAttribute("data-person", "me");
  await page.getByTestId("day-review-switch").click();
  await expect(page.getByTestId("day-review")).toHaveCount(0);
  await expect(today).toHaveAttribute("data-owner", "me");
  await expect(page.getByTestId("today-count")).toContainText("0/6");
  const partner = page.getByTestId("partner-glance");
  await expect(partner).toHaveAttribute("data-partner", "elena");
  await expect(partner).toContainText("לאחרונה: סלט ירקות · ארוחה מרכזית");
  await expect(partner.locator("[data-slot='lunch']")).toHaveAttribute("data-status", "logged");

  // The FAB logs into Ariel's first empty slot, as Ariel.
  await page.getByRole("button", { name: "הוספה מהירה" }).click();
  await expect(page.getByRole("dialog", { name: "פתיחת חלון אכילה · אריאל" })).toBeVisible();
  await page.getByRole("button", { name: "סגירה" }).click();

  // Yesterday: both cards follow the selected date and show empty days.
  await page.getByRole("button", { name: "יום קודם" }).click();
  await expect(today).toContainText("תאריך");
  await expect(page.getByTestId("today-count")).toContainText("0/6");
  await expect(partner.locator("[data-slot='lunch']")).toHaveAttribute("data-status", "empty");
  await page.getByRole("button", { name: "יום הבא" }).click();

  // Reload: attribution survives (demo store persists locally in this mode).
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByTestId("today-card")).toHaveAttribute("data-owner", "elena"); // device default
  await expect(page.getByTestId("today-count")).toContainText("1/6");
  await expect(page.getByTestId("partner-glance")).toHaveAttribute("data-partner", "me");
});
