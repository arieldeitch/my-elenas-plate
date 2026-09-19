/**
 * Mobile / RTL / accessibility QA walk of the whole daily loop (M2-1…M2-6) on the
 * hermetic dev server, Docker-free. For every screen state it records:
 *   - horizontal overflow of the page and of any open dialog;
 *   - whether the primary bottom action (סיום / שמירה) is inside the viewport;
 *   - buttons/links smaller than 40×40 css px (touch targets);
 *   - axe-core violations (serious + critical) — axe is injected from node_modules;
 * and writes a screenshot. Two viewports: 360×740 and Pixel 7 (412×915).
 *
 *   npx vite dev --mode hermetic --port 4336
 *   node scripts/mobile-qa.mjs [outDir]   # default test-results/mobile-qa
 */
import { chromium, devices } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.HOME_SNAPSHOT_URL ?? "http://localhost:4336/";
const OUT = process.argv[2] ?? "test-results/mobile-qa";
mkdirSync(OUT, { recursive: true });
const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const VIEWPORTS = {
  narrow360: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
  pixel7: devices["Pixel 7"],
};

const report = [];
function log(line) {
  console.log(line);
  report.push(line);
}

async function audit(page, name, label, { axe = true } = {}) {
  await page.waitForTimeout(450);
  const vw = page.viewportSize();
  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const dialog = document.querySelector("[role=dialog]");
    const overflowX = doc.scrollWidth > doc.clientWidth + 1;
    const dialogOverflow = dialog ? dialog.scrollWidth > dialog.clientWidth + 1 : false;
    const small = [];
    for (const el of document.querySelectorAll("button, a[href], [role=button]")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (r.width < 40 || r.height < 40) {
        const name =
          el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || el.className;
        small.push(`${Math.round(r.width)}×${Math.round(r.height)} "${name}"`);
      }
    }
    const primary = [...document.querySelectorAll("button")].find((b) =>
      /^(סיום|שמירה|שמירת השקילה|הוספת המאכל)$/.test(b.textContent?.trim() ?? ""),
    );
    const pr = primary?.getBoundingClientRect();
    return {
      overflowX,
      dialogOverflow,
      small,
      primary: pr
        ? {
            text: primary.textContent.trim(),
            bottom: Math.round(pr.bottom),
            top: Math.round(pr.top),
          }
        : null,
      dir: doc.getAttribute("dir"),
      focused: document.activeElement
        ? `${document.activeElement.tagName.toLowerCase()}${document.activeElement.getAttribute("aria-label") ? `[${document.activeElement.getAttribute("aria-label")}]` : ""}`
        : null,
    };
  });
  let axeSummary = "axe: skipped";
  if (axe) {
    await page.addScriptTag({ content: AXE }).catch(() => {});
    const res = await page.evaluate(async () => {
      // @ts-ignore
      const r = await window.axe.run(document, {
        runOnly: ["wcag2a", "wcag2aa", "best-practice"],
        rules: { "color-contrast": { enabled: true } },
      });
      return r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
      }));
    });
    const serious = res.filter((v) => v.impact === "serious" || v.impact === "critical");
    axeSummary = `axe: ${res.length} violations (${serious.length} serious/critical)${
      res.length ? " → " + res.map((v) => `${v.id}[${v.impact}] ${v.nodes[0]}`).join("; ") : ""
    }`;
  }
  const primaryNote = m.primary
    ? `${m.primary.text} @${m.primary.top}–${m.primary.bottom}${m.primary.bottom <= vw.height ? " (in view)" : " (BELOW FOLD)"}`
    : "—";
  log(
    `[${name}] ${label}: overflowX=${m.overflowX} dialogOverflow=${m.dialogOverflow} primary=${primaryNote} small=${m.small.length}${
      m.small.length ? " " + m.small.slice(0, 6).join(" | ") : ""
    } focus=${m.focused} ${axeSummary}`,
  );
  await page.screenshot({ path: `${OUT}/${name}-${label.replace(/[^a-z0-9]+/gi, "-")}.png` });
}

async function hydrated(page) {
  await page.waitForFunction(() => window.__ELENAS_PLATE_BUILD__ !== undefined, null, {
    timeout: 30_000,
  });
}

async function openMeal(page, slotLabel) {
  await page.getByRole("button", { name: new RegExp(`^${slotLabel}:`) }).click();
  await page.getByRole("dialog", { name: slotLabel }).waitFor();
}

const browser = await chromium.launch();
for (const [name, opts] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ ...opts, locale: "he-IL" });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await hydrated(page);

  // 1. first-device person chooser
  await audit(page, name, "01-chooser");
  await page.getByRole("dialog").getByRole("button", { name: /אלנה/ }).click();
  // 4/5. home, empty day
  await audit(page, name, "02-home-empty");

  // 9/10. MealEditor + typed search + direct add (count unit)
  await openMeal(page, "ארוחה מרכזית");
  await audit(page, name, "03-meal-editor-empty");
  await page.getByLabel("חיפוש מאכל").fill("ביצה");
  await audit(page, name, "04-typed-search", { axe: false });
  const egg = page.getByTestId("search-result").filter({ hasText: "ביצה קשה" }).first();
  await egg.click();
  // 12. stepper
  await audit(page, name, "05-after-direct-add");
  await page.getByTestId("qty-plus").first().click();
  await page.getByTestId("qty-plus").first().click();
  await audit(page, name, "06-stepper-3", { axe: false });
  // 13. weight/volume fallback
  await page.getByLabel("חיפוש מאכל").fill("קוטג");
  const cottage = page.getByTestId("search-result").filter({ hasText: "קוטג" }).first();
  await cottage.click();
  await audit(page, name, "07-quantity-fallback");
  await page.locator('input[type="number"]').first().fill("150");
  await page.getByRole("button", { name: "הוספת המאכל" }).click();
  // 19. long food name (custom)
  await page.getByLabel("חיפוש מאכל").fill("שקשוקה עם ביצים ועגבניות ופלפלים קלויים בתנור");
  await page.getByRole("button", { name: /כמאכל חדש/ }).click();
  await page.getByRole("button", { name: "הוספת המאכל" }).click();
  // 20. multiple foods in one slot
  await audit(page, name, "08-editor-three-foods");
  await page.getByRole("button", { name: "סיום" }).click();
  await audit(page, name, "09-home-partial");

  // 11. recent chip (the egg is now recent)
  await openMeal(page, "ארוחת ערב");
  const chip = page.getByRole("button", { name: /ביצה קשה/ }).first();
  await chip.click().catch(() => {});
  await audit(page, name, "10-recent-chip-add", { axe: false });
  await page.getByRole("button", { name: "סיום" }).click();

  // skip a meal
  await openMeal(page, "נשנוש ראשון");
  await page.getByRole("button", { name: "לא נאכלה ארוחה" }).click();
  await audit(page, name, "11-meal-skipped", { axe: false });
  await page.getByRole("button", { name: "סגירה" }).click();

  // 15/16/17. fasting, workout, weigh-in via the context row
  await page.getByTestId("context-fasting").click();
  await audit(page, name, "12-fasting-editor");
  await page.getByLabel("תחילת הצום").fill("20:00");
  await page.getByLabel("סיום הצום").fill("12:00");
  await page.getByRole("button", { name: "שמירה" }).click();
  await page.getByTestId("context-workout").click();
  await audit(page, name, "13-workout-editor");
  await page.getByRole("button", { name: "כן", exact: true }).click();
  await page.getByTestId("daily-context-panel").getByRole("button", { name: "סגירה" }).click();
  await page
    .getByRole("button", { name: "שקילה" })
    .click()
    .catch(() => page.getByRole("button", { name: "פתיחת טופס שקילה" }).click());
  await audit(page, name, "14-weigh-in");
  await page.locator('input[type="number"]').first().fill("72.4");
  await page.getByRole("button", { name: "שמירת השקילה" }).click();

  // 7. full six-slot day
  for (const slot of ["פתיחת חלון אכילה", "נשנוש אחר הצהריים", "ארוחה נוספת"]) {
    await openMeal(page, slot);
    await page.getByLabel("חיפוש מאכל").fill("תפוח");
    await page.getByTestId("search-result").filter({ hasText: "תפוח" }).first().click();
    await page.getByRole("button", { name: "סיום" }).click();
  }
  await audit(page, name, "15-home-full");
  await page.screenshot({ path: `${OUT}/${name}-15-home-full.png` });

  // Keyboard-height condition: the focused steps field and its submit action
  // must both remain reachable in a 420px visual viewport.
  await page.getByTestId("context-steps").click();
  const countInput = page.getByLabel("מספר צעדים");
  await countInput.focus();
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: originalViewport.width, height: 420 });
  await page.waitForTimeout(150);
  const keyboardSafety = await page.evaluate(() => {
    const input = document.querySelector("#steps-count")?.getBoundingClientRect();
    const save = [...document.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "שמירה")
      ?.getBoundingClientRect();
    return {
      inputVisible: Boolean(input && input.top >= 0 && input.bottom <= window.innerHeight),
      saveVisible: Boolean(save && save.top >= 0 && save.bottom <= window.innerHeight),
    };
  });
  log(`[${name}] keyboard-steps: input=${keyboardSafety.inputVisible} save=${keyboardSafety.saveVisible}`);
  if (!keyboardSafety.inputVisible || !keyboardSafety.saveVisible) {
    throw new Error(`${name}: steps input or save action is hidden by constrained viewport`);
  }
  await page.screenshot({ path: `${OUT}/${name}-keyboard-steps.png` });
  await page.setViewportSize(originalViewport);
  await page.getByRole("button", { name: "ביצעתי את יעד הצעדים" }).click();

  // 14. Day Review (own) + 8. partner glance → partner review
  await page.getByTestId("today-review").click();
  await audit(page, name, "16-day-review");
  await page.getByRole("button", { name: "סגירה" }).click();
  await page.getByTestId("partner-glance").click();
  await audit(page, name, "17-partner-review");
  await page.getByTestId("day-review-switch").click();
  await audit(page, name, "18-switched-to-partner", { axe: false });

  // 18. past date
  await page.getByRole("button", { name: "יום קודם" }).click();
  await audit(page, name, "19-yesterday", { axe: false });
  await page.getByRole("button", { name: "יום הבא" }).click();

  // 2/3. loading + connection failure states are rendered by AuthGate only in
  // cloud mode; they are covered by the vitest suite and the production smoke.
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/report.txt`, report.join("\n"));
console.log(`\nreport → ${OUT}/report.txt`);
