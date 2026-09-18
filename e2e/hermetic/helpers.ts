import { expect, type Page } from "@playwright/test";

/**
 * The page is server-rendered; interactive handlers exist only after React
 * hydrates. `logBuildInfo` runs in a mount effect and publishes the build hook
 * on `window`, so its presence is a reliable "hydrated" signal.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __ELENAS_PLATE_BUILD__?: unknown }).__ELENAS_PLATE_BUILD__ !==
            undefined,
        ),
      { timeout: 30_000 },
    )
    .toBe(true);
}
