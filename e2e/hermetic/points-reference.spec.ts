import { test, expect } from "@playwright/test";
import { waitForHydration } from "./helpers";

/**
 * DEC-035 acceptance item 16 — the reference flow on a narrow phone screen
 * (Pixel 7 profile, hermetic demo store, no backend): compact results with
 * portion · points · category, a variation picker, a reference-aware quantity
 * screen that refuses an unsafe unit, and an unknown name that can only become a
 * personal alias of a reference food (DEC-036).
 * Nothing overflows horizontally and every tap target stays reachable.
 */
test("reference search → variation → quantity → add, then a confirmed new food, all on a phone", async ({
  page,
}) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("dialog").getByRole("button", { name: /אריאל/ }).click();

  await page.getByRole("button", { name: /^ארוחה מרכזית:/ }).click();
  const dialog = page.getByRole("dialog", { name: "ארוחה מרכזית · אריאל" });
  const searchBox = page.getByLabel("חיפוש מאכל");

  // Reference-only food with two portions: compact line, then the picker.
  await searchBox.fill("אגוז ברזיל");
  const result = dialog.getByTestId("search-result").filter({ hasText: "אגוז ברזיל" }).first();
  await expect(result.getByTestId("result-detail")).toHaveText("2 כמויות · 1–19 נק׳ · שומנים");
  await result.click();
  const picker = page.getByTestId("variant-picker");
  await expect(picker.getByTestId("variant-option")).toHaveCount(2);
  await picker.getByTestId("variant-option").first().click();

  // Quantity screen: reference line, prefilled portion, exact preview, safe scaling.
  await expect(page.getByTestId("reference-line")).toContainText("2 יחידה = 1 נק׳");
  await expect(page.getByTestId("points-preview")).toHaveAttribute("data-basis", "reference:exact");
  await page.getByRole("spinbutton").fill("4");
  await expect(page.getByTestId("points-preview")).toHaveAttribute("data-points", "2");
  await page.getByRole("button", { name: "הוספת המאכל" }).click();
  await expect(page.getByTestId("meal-entries").getByText("אגוז ברזיל")).toBeVisible();
  await expect(page.getByTestId("meal-entry").first()).toContainText("2 נק׳");

  // Linked built-in food (avocado, 30 גרם = 1): a cup is refused, grams scale.
  await searchBox.fill("אבוקדו");
  await dialog.getByTestId("search-result").filter({ hasText: "אבוקדו" }).first().click();
  await expect(page.getByRole("spinbutton")).toHaveValue("30");
  await page.getByRole("button", { name: "יחידות נוספות" }).click();
  await page.getByRole("button", { name: "כוס", exact: true }).click();
  await expect(page.getByTestId("points-preview")).toHaveAttribute("data-points", "blocked");
  await expect(page.getByRole("button", { name: "הוספת המאכל" })).toBeDisabled();
  await page.getByRole("button", { name: "גרם", exact: true }).click();
  await page.getByRole("spinbutton").fill("60");
  await expect(page.getByTestId("points-preview")).toHaveAttribute("data-points", "2");
  await page.getByRole("button", { name: "הוספת המאכל" }).click();
  await expect(page.getByTestId("meal-entry")).toHaveCount(2);

  // Unknown name (DEC-036): no new-food form — only a personal alias of a reference food.
  await searchBox.fill("מאפין של סבתא");
  await page.getByRole("button", { name: /קישור לשם אישי/ }).click();
  const form = page.getByTestId("personal-alias-form");
  await expect(form).toBeVisible();
  await expect(page.getByTestId("pa-save")).toBeDisabled();
  await page.getByLabel("המאכל במאגר").fill("מאפין");
  await page.getByTestId("pa-option").filter({ hasText: "מאפין שוקולד" }).first().click();
  await page.getByTestId("pa-save").click();
  await expect(page.getByTestId("reference-line")).toContainText("1 יחידה (45 גרם) = 5 נק׳");
  await expect(page.getByTestId("points-preview")).toHaveAttribute("data-basis", "reference:exact");
  await page.getByRole("button", { name: "הוספת המאכל" }).click();
  await expect(page.getByTestId("meal-entry")).toHaveCount(3);
  await expect(page.getByTestId("meal-entry").last()).toContainText("מאפין שוקולד");
  // The personal name now finds the reference food — one card, alias shown.
  await searchBox.fill("מאפין של סבתא");
  const aliasHit = dialog.getByTestId("search-result").first();
  await expect(aliasHit).toContainText("מאפין שוקולד");
  await expect(aliasHit.getByTestId("result-alias")).toHaveText("נמצא לפי: מאפין של סבתא");
  await expect(dialog.getByTestId("search-result").filter({ hasText: "מאפין שוקולד" })).toHaveCount(
    1,
  );
  await searchBox.fill("");

  // Narrow screen: no horizontal overflow anywhere in the sheet.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "סיום" }).click();
  await expect(page.getByTestId("today-count")).toContainText("1/6");
});
