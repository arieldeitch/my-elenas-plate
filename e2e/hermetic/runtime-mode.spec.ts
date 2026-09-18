import { test, expect } from "@playwright/test";
import { waitForHydration } from "./helpers";

/**
 * M1 Test 8 (demo half) — cloud/demo mode truth, hermetic. The cloud half
 * (env present → cloud copy, no demo copy) is covered by the component test
 * and by the hosted-branch browser run.
 */
test("without Supabase env the build is explicitly in demo mode and never talks to Supabase", async ({
  page,
}) => {
  const supabaseRequests: string[] = [];
  page.on("request", (req) => {
    if (/supabase\.(co|in)|127\.0\.0\.1:54321/.test(req.url())) supabaseRequests.push(req.url());
  });

  await page.goto("/");
  await waitForHydration(page);
  await expect(page).toHaveTitle(/גרסת הדגמה/);
  const notice = page.locator("[data-runtime-mode='demo']");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("מצב הדגמה — ללא סנכרון ענן");
  await expect(notice).toContainText("בדפדפן הזה בלבד");
  // Never the cloud copy in demo mode.
  await expect(page.getByText(/נשמרים בענן המשותף/)).toHaveCount(0);

  // Build identity is observable from the page and from the console/window hook.
  const sha = await notice.getAttribute("data-build-sha");
  expect(sha).toMatch(/^[0-9a-f]{7,}$/);
  const info = await page.evaluate(
    () => (window as unknown as { __ELENAS_PLATE_BUILD__?: unknown }).__ELENAS_PLATE_BUILD__,
  );
  expect(info).toMatchObject({ mode: "demo", sha, productionBuild: false, misconfigured: false });

  // Log something and make sure no request ever left for a Supabase host.
  await page.getByRole("dialog").getByRole("button", { name: /אריאל/ }).click();
  await page.waitForTimeout(500);
  expect(supabaseRequests).toEqual([]);
});
