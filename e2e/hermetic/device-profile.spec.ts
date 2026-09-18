import { test, expect } from "@playwright/test";
import { waitForHydration } from "./helpers";

const DEVICE_KEY = "elenas-plate:device-profile:v1";

/**
 * M1 Test 7 — device default profile (hermetic, demo mode, no backend).
 */
test("a fresh device is asked who uses it; the answer is the default after reload", async ({
  page,
}) => {
  await page.goto("/");
  await waitForHydration(page);
  const chooser = page.getByRole("dialog", { name: "מי משתמש/ת במכשיר הזה?" });
  await expect(chooser).toBeVisible();
  // No silent default: the chooser cannot be dismissed before a choice.
  await expect(chooser.getByRole("button", { name: "ביטול" })).toHaveCount(0);

  await chooser.getByRole("button", { name: /אלנה/ }).click();
  await expect(chooser).toBeHidden();
  await expect(page.getByRole("tab", { name: /אלנה/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("device-profile-default")).toHaveText(/אלנה/);

  // Only the preference is stored under the device key — a bare profile id.
  const stored = await page.evaluate((k) => window.localStorage.getItem(k), DEVICE_KEY);
  expect(stored).toBe("elena");

  // Reload: Elena is active by default and the chooser does not reappear.
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole("tab", { name: /אלנה/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Switching to Ariel still works (temporary) and does not change the default.
  await page.getByRole("tab", { name: /אריאל/ }).click();
  await expect(page.getByRole("tab", { name: /אריאל/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("device-profile-default")).toHaveText(/אלנה/);
  await page.reload();
  await expect(page.getByRole("tab", { name: /אלנה/ })).toHaveAttribute("aria-selected", "true");
});

test("the device default can be changed from the switcher", async ({ page }) => {
  // Seed the device preference once (NOT via addInitScript, which would re-apply
  // "elena" on the reload at the end and hide the change we are testing).
  await page.goto("/");
  await waitForHydration(page);
  await page.evaluate((k) => window.localStorage.setItem(k, "elena"), DEVICE_KEY);
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByTestId("device-profile-default").click();
  const chooser = page.getByRole("dialog", { name: "מי משתמש/ת במכשיר הזה?" });
  await expect(chooser).toBeVisible();
  await chooser.getByRole("button", { name: /אריאל/ }).click();
  await expect(chooser).toBeHidden();
  expect(await page.evaluate((k) => window.localStorage.getItem(k), DEVICE_KEY)).toBe("me");
  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole("tab", { name: /אריאל/ })).toHaveAttribute("aria-selected", "true");
});
