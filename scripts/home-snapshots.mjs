/**
 * Visual check of the mobile home screen (M2). Docker-free: drives the hermetic
 * dev server (demo mode, no backend) with Playwright and writes screenshots plus
 * a small measurement report — page height and which blocks sit above the
 * fold — for two phone viewports and several realistic day states.
 *
 *   npx vite dev --mode hermetic --port 4336      # in one terminal
 *   node scripts/home-snapshots.mjs [outDir]      # default: test-results/home-snapshots
 *
 * States captured per viewport: empty day, partial day (2 slots + weight +
 * fasting + workout), full day, and the partner's view of that day.
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.HOME_SNAPSHOT_URL ?? "http://localhost:4336/";
const OUT = process.argv[2] ?? "test-results/home-snapshots";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  pixel7: devices["Pixel 7"],
  narrow360: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
};
const BLOCKS = [
  ["today-card", "today"],
  ["partner-glance", "partner"],
  ["meal-tiles", "meal tiles"],
  ["daily-context", "context row"],
];

async function measure(page, label) {
  const fold = page.viewportSize().height;
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const rows = [];
  for (const [id, name] of BLOCKS) {
    const box = await page
      .getByTestId(id)
      .first()
      .boundingBox()
      .catch(() => null);
    if (!box) rows.push(`${name}: (absent)`);
    else {
      const bottom = Math.round(box.y + box.height);
      rows.push(
        `${name}: y=${Math.round(box.y)}–${bottom} ${bottom <= fold ? "ABOVE fold" : bottom - box.height < fold ? "PARTLY visible" : "below fold"}`,
      );
    }
  }
  console.log(`[${label}] page height ${height}px, fold ${fold}px\n  ` + rows.join("\n  "));
}

async function hydrated(page) {
  await page.waitForFunction(() => window.__ELENAS_PLATE_BUILD__ !== undefined, null, {
    timeout: 30_000,
  });
}

async function addFood(page, slotLabel, food) {
  await page.getByRole("button", { name: new RegExp(`^${slotLabel}:`) }).click();
  await page.getByLabel("חיפוש מאכל").fill(food);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(`^${food}`) })
    .first()
    .click();
  await page.getByRole("button", { name: "הוספת המאכל" }).click();
  await page.getByRole("button", { name: "סיום" }).click();
}

const browser = await chromium.launch();
for (const [name, opts] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ ...opts, locale: "he-IL" });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await hydrated(page);
  await page.getByRole("dialog").getByRole("button", { name: /אלנה/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-1-empty.png` });
  await page.screenshot({ path: `${OUT}/${name}-1-empty-full.png`, fullPage: true });
  await measure(page, `${name} empty`);

  await addFood(page, "ארוחה מרכזית", "סלט ירקות");
  await addFood(page, "ארוחת ערב", "שקשוקה");
  await page
    .getByRole("button", { name: "שקילה" })
    .click()
    .catch(() => page.getByRole("button", { name: "פתיחת טופס שקילה" }).click());
  await page.locator('input[type="number"]').first().fill("72.4");
  await page.getByRole("button", { name: "שמירת השקילה" }).click();
  // fasting + workout through the context row (present since M2-3)
  const fastingCell = page.getByTestId("context-fasting");
  if (await fastingCell.count()) {
    await fastingCell.click();
    await page.getByLabel("תחילת הצום").fill("20:00");
    await page.getByLabel("סיום הצום").fill("12:00");
    await page.getByRole("button", { name: "שמירה" }).click();
    await page.getByTestId("context-workout").click();
    await page.getByRole("button", { name: "כן", exact: true }).click();
    await page.getByTestId("daily-context-panel").getByRole("button", { name: "סגירה" }).click();
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-2-partial.png` });
  await page.screenshot({ path: `${OUT}/${name}-2-partial-full.png`, fullPage: true });
  await measure(page, `${name} partial`);

  for (const slot of ["פתיחת חלון אכילה", "נשנוש ראשון", "נשנוש אחר הצהריים", "ארוחה נוספת"]) {
    await addFood(page, slot, "תפוח");
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-3-full.png` });
  await measure(page, `${name} full`);

  await page.getByTestId("partner-glance").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-4-partner-view.png` });
  await measure(page, `${name} partner view (Ariel, empty day)`);
  await ctx.close();
}
await browser.close();
console.log(`screenshots in ${OUT}`);
