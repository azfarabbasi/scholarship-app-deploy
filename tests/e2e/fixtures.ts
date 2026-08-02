import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Phase 4 item 11: every test fails if the page logs an unexpected browser
 * console error or throws an uncaught exception, not just if its own
 * explicit assertions fail. Without this, a real bug (a broken client
 * component, an unhandled promise rejection) could render something that
 * LOOKS fine to a `toBeVisible()` check while silently erroring in the
 * background — this app's client code has no legitimate `console.error`/
 * `console.warn` call sites at all (confirmed by inspecting `src/components`
 * and every client-invoked module).
 *
 * Two patterns are allowlisted globally, not app bugs but the browser's own
 * network layer logging a condition a test deliberately caused:
 *  - `net::ERR_INTERNET_DISCONNECTED` — logged by every in-flight request
 *    when a test calls `context.setOffline(true)` (offline.spec.ts,
 *    staff-auth.spec.ts, student-auth-and-sync.spec.ts all do this
 *    deliberately) — this is Playwright/Chromium's own offline simulation,
 *    not something app code controls.
 *  - "the server responded with a status of 4xx" — Chromium logs this for
 *    ANY non-2xx XHR/fetch response, including a deliberately-wrong-password
 *    sign-in attempt that correctly returns 400 and is correctly handled by
 *    the app (shown as a friendly inline error, exactly what those tests
 *    assert). Deliberately scoped to 4xx only, not 5xx — a real server
 *    error should still fail a test that didn't ask for one.
 * A test exercising some OTHER specific, understood browser-logged message
 * can call `page.allowConsoleError(pattern)` before triggering it, rather
 * than this fixture silently tolerating anything by default.
 */
const DEFAULT_ALLOWED_PATTERNS = [/net::ERR_INTERNET_DISCONNECTED/, /the server responded with a status of 4\d\d/];

type FixturePage = Page & { allowConsoleError(pattern: RegExp): void };

export const test = base.extend<{ page: FixturePage }>({
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

    const allowedPatterns: RegExp[] = [...DEFAULT_ALLOWED_PATTERNS];
    const unexpectedMessages: string[] = [];

    const fixturePage = page as FixturePage;
    fixturePage.allowConsoleError = (pattern: RegExp) => {
      allowedPatterns.push(pattern);
    };

    function record(message: string) {
      if (allowedPatterns.some((pattern) => pattern.test(message))) {
        return;
      }
      unexpectedMessages.push(message);
    }

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        record(msg.text());
      }
    });
    page.on("pageerror", (error) => {
      record(error.message);
    });

    await runTest(fixturePage);

    expect(unexpectedMessages, `Unexpected browser console/page error(s):\n${unexpectedMessages.join("\n")}`).toEqual([]);
  },
});

export { expect };
