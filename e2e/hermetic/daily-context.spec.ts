import { test, expect } from "@playwright/test";
import { waitForHydration } from "./helpers";

/**
 * M2-3 — the compact daily context row (weight · workout · fasting) under the
 * meal tiles, hermetic. State is readable without opening anything; editors
 * unfold on demand; everything stays per person and per day.
 */
test("weight, workout and fasting live in one row; editors unfold; the partner sees the result", async ({
  page,
}) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("dialog").getByRole("button", { name: /אלנה/ }).click();

  const row = page.getByTestId("daily-context");
  await expect(row).toBeVisible();
  await expect(page.getByTestId("context-weight")).toHaveAttribute("data-value", "—");
  await expect(page.getByTestId("context-workout")).toHaveAttribute("data-value", "לא תועד");
  await expect(page.getByTestId("context-fasting")).toHaveAttribute("data-value", "לא תועד");
  // Nothing large on the home: no editor is open, no fixed banner.
  await expect(page.getByTestId("daily-context-panel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "פתיחת טופס שקילה" })).toHaveCount(1);

  // Weight: the cell opens the existing form; the value lands in the cell.
  await page.getByRole("button", { name: /פתיחת טופס שקילה/ }).click();
  await page.locator('input[type="number"]').first().fill("64.2");
  await page.getByRole("button", { name: "שמירת השקילה" }).click();
  await expect(page.getByTestId("context-weight")).toHaveAttribute("data-value", "64.2 ק״ג");
  await expect(page.getByTestId("context-weight")).toContainText("היום");

  // Fasting: unfold, save 20:00 → 12:00, the cell shows 16h and the window.
  await page.getByTestId("context-fasting").click();
  await expect(page.getByTestId("fasting-editor")).toBeVisible();
  await page.getByLabel("תחילת הצום").fill("20:00");
  await page.getByLabel("סיום הצום").fill("12:00");
  await page.getByRole("button", { name: "שמירה" }).click();
  await expect(page.getByTestId("daily-context-panel")).toHaveCount(0);
  await expect(page.getByTestId("context-fasting")).toHaveAttribute("data-value", "16 שעות");
  await expect(page.getByTestId("context-fasting")).toContainText("20:00–12:00");

  // Workout: unfold, "כן" → type chips; pick one; fold from the cell.
  await page.getByTestId("context-workout").click();
  await page.getByTestId("workout-editor").getByRole("button", { name: "כן", exact: true }).click();
  await page.getByRole("button", { name: "ריצה", exact: true }).click();
  await expect(page.getByTestId("context-workout")).toHaveAttribute("data-value", "ריצה");
  await page.getByTestId("context-workout").click();
  await expect(page.getByTestId("daily-context-panel")).toHaveCount(0);

  // Ariel's view: his own row is empty, and her fasting + workout show on her card.
  await page.getByTestId("partner-glance").click();
  await expect(page.getByTestId("context-fasting")).toHaveAttribute("data-value", "לא תועד");
  await expect(page.getByTestId("context-workout")).toHaveAttribute("data-value", "לא תועד");
  await expect(page.getByTestId("partner-fasting")).toContainText("20:00–12:00");
  await expect(page.getByTestId("partner-workout")).toBeVisible();
  // Weight is per person too: Ariel has none.
  await expect(page.getByTestId("context-weight")).toHaveAttribute("data-value", "—");

  // Reload keeps all of it (demo store persists locally in this mode).
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByTestId("context-fasting")).toHaveAttribute("data-value", "16 שעות");
  await expect(page.getByTestId("context-weight")).toHaveAttribute("data-value", "64.2 ק״ג");
});
