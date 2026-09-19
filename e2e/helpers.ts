import { expect, type Page } from "@playwright/test";

const DOMAIN = process.env.E2E_EMAIL_DOMAIN || "nutritiontracker.dev";
export const PASSWORD = "password123";

export function uniqueEmail(): string {
  return `e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}@${DOMAIN}`;
}

/** Fills the SignIn form (password mode) and waits for the app shell. */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  // SignIn renders once the AuthGate resolves (configured, no session).
  await page.getByRole("button", { name: "סיסמה" }).click();
  await page.getByLabel("אימייל").fill(email);
  await page.getByLabel("סיסמה").fill(PASSWORD);
  await page.getByRole("button", { name: "כניסה" }).click();
  await waitForApp(page);
}

/** Waits for the authenticated app (profile switcher + meal grid). */
export async function waitForApp(page: Page): Promise<void> {
  await expect(page.getByRole("tab", { name: /אריאל/ })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("heading", { name: "ארוחות היום" })).toBeVisible();
}

/** Opens a meal editor by its Hebrew slot label (matches the tile aria-label). */
export async function openMeal(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: new RegExp(`^${label}:`) }).click();
  await expect(page.getByRole("dialog", { name: label })).toBeVisible();
}

export async function closeDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "סגירה" }).first().click();
}

/** True once the sync indicator shows "נשמר" (saved) — best-effort settle. */
export async function waitSaved(page: Page): Promise<void> {
  await expect(page.getByText("נשמר", { exact: true }))
    .toBeVisible({ timeout: 20_000 })
    .catch(() => {});
  await page.waitForTimeout(1500); // let the debounced push flush to Supabase
}

/** Opens a meal and adds a catalog food by name via search. Leaves the dialog open. */
export async function addSearchedFood(page: Page, mealLabel: string, food: string): Promise<void> {
  await openMeal(page, mealLabel);
  await page.getByRole("button", { name: "הוספת מאכל" }).first().click();
  await page.getByLabel("חיפוש מאכל").fill(food);
  await page
    .getByRole("button", { name: new RegExp(food) })
    .first()
    .click();
  await page.getByRole("button", { name: "הוספת המאכל" }).click();
  await page.getByRole("button", { name: "חזרה לארוחה" }).click();
  await expect(page.getByText(food).first()).toBeVisible();
}
