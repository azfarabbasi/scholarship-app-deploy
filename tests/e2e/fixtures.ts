import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Extends the base `page` fixture so every `goto()` call waits for the
 * app's hydration marker before returning. Without this, a fast `fill()`
 * issued against a server-rendered-but-not-yet-hydrated controlled input can
 * be silently clobbered by React's first client render.
 */
export const test = base.extend<{ page: Page }>({
  // Playwright's fixture callback is positional: (fixtures, runTest). Naming
  // the second parameter "use" (as Playwright's own docs do) makes eslint's
  // react-hooks plugin misidentify it as React's `use()` hook; renaming it
  // avoids that false positive without changing behaviour.
  page: async ({ page }, runTest) => {
    const originalGoto = page.goto.bind(page);
    page.goto = (async (url, options) => {
      const response = await originalGoto(url, options);
      await page
        .waitForSelector('html[data-hydrated="true"]', { state: "attached", timeout: 10_000 })
        .catch(() => undefined);
      return response;
    }) as typeof page.goto;

    await runTest(page);
  },
});

export { expect };
