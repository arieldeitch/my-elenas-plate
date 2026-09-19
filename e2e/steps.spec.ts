import { test, expect } from "@playwright/test";
import { signIn, uniqueEmail, waitForApp, waitSaved } from "./helpers";

test("steps support exact, completed-only, goal editing and profile/date isolation", async ({ page }) => {
  await signIn(page, uniqueEmail());
  await page.getByRole("button", { name: /^צעדים:/ }).click();
  await expect(page.getByText(/יעד 10,000/)).toBeVisible();
  await page.getByLabel("מספר מדויק").fill("8734");
  await page.getByRole("button", { name: "שמירת מספר" }).click();
  await expect(page.getByRole("button", { name: /צעדים: 8,734/ })).toBeVisible();

  await page.getByRole("tab", { name: /אלנה/ }).click();
  await expect(page.getByRole("button", { name: /צעדים: לא תועד/ })).toBeVisible();
  await page.getByRole("button", { name: /^צעדים:/ }).click();
  await page.getByRole("button", { name: /ביצעתי/ }).click();
  await expect(page.getByRole("button", { name: /צעדים: בוצע/ })).toBeVisible();

  await page.getByRole("button", { name: "יום קודם" }).click();
  await page.getByRole("button", { name: /^צעדים:/ }).click();
  await page.getByRole("button", { name: "עריכת יעד" }).click();
  await page.getByLabel("יעד צעדים יומי").fill("9000");
  await page.getByRole("button", { name: "שמירת יעד צעדים" }).click();
  await page.getByLabel("מספר מדויק").fill("9000");
  await page.getByRole("button", { name: "שמירת מספר" }).click();
  await waitSaved(page);

  await page.reload();
  await waitForApp(page);
  await page.getByRole("tab", { name: /אלנה/ }).click();
  await page.getByRole("button", { name: "יום קודם" }).click();
  await expect(page.getByRole("button", { name: /צעדים: 9,000/ })).toBeVisible();
});

test("focused step input remains visible in a keyboard-constrained viewport", async ({ page }) => {
  await signIn(page, uniqueEmail());
  await page.getByRole("button", { name: /^צעדים:/ }).click();
  const input = page.getByLabel("מספר מדויק");
  await input.focus();
  await page.setViewportSize({ width: 360, height: 420 });
  await expect(input).toBeInViewport();
  await expect(page.getByRole("button", { name: "שמירת מספר" })).toBeInViewport();
});