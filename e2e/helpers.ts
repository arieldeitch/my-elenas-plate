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

/**
 * Waits for the authenticated app (profile switcher + meal grid) and answers
 * the one-time device chooser (M1 Phase B) as Ariel so the meal grid is
 * interactive. Pass `device` to pick Elena for a "second phone" context.
 */
export async function waitForApp(page: Page, device: "me" | "elena" = "me"): Promise<void> {
  await expect(page.getByRole("tab", { name: /אריאל/ })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("heading", { name: "ארוחות היום" })).toBeVisible();
  const chooser = page.getByRole("dialog", { name: "מי משתמש/ת במכשיר הזה?" });
  if (await chooser.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await chooser.getByRole("button", { name: device === "me" ? /אריאל/ : /אלנה/ }).click();
    await expect(chooser).toBeHidden();
  }
}

/** Opens a meal editor by its Hebrew slot label (matches the tile aria-label). */
export async function openMeal(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: new RegExp(`^${label}:`) }).click();
  await expect(page.getByRole("dialog", { name: label })).toBeVisible();
}

export async function closeDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: "סגירה" }).first().click();
}

/**
 * Waits until the sync indicator shows "נשמר". Since M1 the state is derived
 * from the durable queue, so "saved" means every operation was confirmed by
 * Supabase — no extra settle time is needed.
 */
export async function waitSaved(page: Page): Promise<void> {
  await expect(page.locator("[data-sync-state='saved']")).toBeVisible({ timeout: 30_000 });
}

/**
 * Waits until the realtime channel of this page is SUBSCRIBED. postgres_changes
 * does not replay events from before the join, so a "second device" must be
 * live before the first one mutates.
 */
export async function waitLive(page: Page): Promise<void> {
  await expect(page.locator("[data-realtime='subscribed']")).toBeVisible({ timeout: 30_000 });
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
