import { expect, test } from "./fixtures";

/**
 * Checkpoint 6 production-readiness scenarios. All twelve scenarios named in
 * the checkpoint brief, mapped to real, running checks — some are new here,
 * others deliberately take a Checkpoint-6-specific angle on behaviour that
 * `staff-auth.spec.ts`/`offline.spec.ts`/`mobile-nav.spec.ts`/
 * `accessibility.spec.ts` already exercise more thoroughly, rather than
 * duplicating those files wholesale.
 */

test.describe("Production readiness", () => {
  test("1. public home has SEO and trust elements", async ({ page, request }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ScholarTrack/);

    // The exact host varies by environment (NEXT_PUBLIC_APP_URL) — just confirm it's a
    // well-formed absolute URL for the site root, with no extra path segments. Next's
    // URL resolution for the root path yields no trailing slash (e.g. "http://host:port"),
    // so the slash itself is optional here.
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /ScholarTrack/);

    const jsonLdBlocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const parsed = jsonLdBlocks.map((block) => JSON.parse(block));
    const graph = parsed.flatMap((entry) => entry["@graph"] ?? [entry]);
    expect(graph.some((entry: { "@type"?: string }) => entry["@type"] === "WebSite")).toBe(true);
    expect(graph.some((entry: { "@type"?: string }) => entry["@type"] === "Organization")).toBe(true);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("Disallow: /staff");
  });

  test("2. a public opportunity page shows an official-source link and a verify disclaimer", async ({ page }) => {
    await page.goto("/opportunities");
    await page.getByLabel("Search opportunities").fill("DAAD");
    await page.getByRole("link", { name: /View details/i }).first().click();

    // The sticky sidebar summary card and the full details section both carry
    // their own "Visit official website" CTA by design (see
    // docs/ui-polish/scholarly-frontend-polish.md) — assert the first one.
    await expect(page.getByRole("link", { name: /visit official website/i }).first()).toBeVisible();
    await expect(page.getByText(/always verify current deadlines/i).first()).toBeVisible();

    const jsonLdBlocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = jsonLdBlocks.map((block) => JSON.parse(block)["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("EducationalOccupationalProgram");
  });

  test("3. private staff/account pages are noindexed and require authentication", async ({ page, request }) => {
    const staffResponse = await request.get("/staff");
    expect(staffResponse.headers()["x-robots-tag"]).toContain("noindex");
    const accountResponse = await request.get("/account");
    expect(accountResponse.headers()["x-robots-tag"]).toContain("noindex");

    await page.goto("/staff");
    await expect(page).toHaveURL(/\/staff\/login/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("4. ad placeholders are absent when ads are disabled (the default)", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByLabel("Advertisement")).toHaveCount(0);
    await page.goto("/faq");
    await expect(page.getByLabel("Advertisement")).toHaveCount(0);
  });

  test("5. analytics stays a safe no-op and never breaks navigation", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => requests.push(req.url()));

    await page.goto("/");
    await page.getByRole("link", { name: "Start exploring" }).first().click();
    await expect(page).toHaveURL(/\/opportunities/);

    expect(requests.some((url) => url.includes("cloudflareinsights.com"))).toBe(false);
    expect(requests.some((url) => url.includes("googlesyndication.com"))).toBe(false);
  });

  test("6. the health endpoint returns safe, secret-free output", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/sb_secret_|gsk_|postgres:\/\//i);

    const ready = await request.get("/api/ready");
    const readyBody = await ready.json();
    expect(JSON.stringify(readyBody)).not.toMatch(/sb_secret_|gsk_|postgres:\/\//i);

    const version = await request.get("/api/version");
    expect(version.ok()).toBe(true);
    const versionBody = await version.json();
    expect(versionBody).toHaveProperty("version");
    expect(versionBody).toHaveProperty("checkpoint", 6);
  });

  test("7. a nonexistent opportunity shows a safe, honest not-found message rather than a raw error", async ({ page }) => {
    const response = await page.goto("/opportunities/this-slug-does-not-exist-at-all", { waitUntil: "commit" });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByText(/doesn.t exist in the catalogue/i)).toBeVisible({ timeout: 10_000 });
  });

  test("8. keyboard navigation reaches the new footer links on a content page", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About ScholarTrack" })).toBeVisible();
    const faqFooterLink = page.getByRole("contentinfo").getByRole("link", { name: "FAQ" });
    await faqFooterLink.focus();
    await expect(faqFooterLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/faq/);
  });

  test("9. mobile layout renders the new content pages without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto("/faq");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("10. the service worker registers and activates on a new static content page", async ({ page }) => {
    // Full offline-round-trip serving for a *freshly added* page is already
    // covered, for the existing app-shell pages, by tests/e2e/offline.spec.ts
    // and tests/e2e/ai-assistant.spec.ts's scenario 12. This test instead
    // checks the one thing specific to Checkpoint 6's twelve new pages: that
    // visiting one doesn't somehow prevent the service worker from
    // registering and reaching "activated" — a real regression risk given
    // `public/sw.js`'s precache list grew from 8 to 20 URLs this checkpoint.
    await page.goto("/about");
    const activated = await page
      .waitForFunction(
        async () => {
          if (!("serviceWorker" in navigator)) return false;
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state === "activated";
        },
        { timeout: 20_000 },
      )
      .then(() => true)
      .catch(() => false);
    expect(activated).toBe(true);
  });

  test("11. core catalogue/workspace features work independent of the AI assistant's configuration", async ({ page }) => {
    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { name: "Opportunity catalogue" })).toBeVisible();
    await page.goto("/workspace");
    await expect(page.getByRole("heading", { name: /workspace/i })).toBeVisible();
  });

  test("12. staff routes remain protected after the Checkpoint 6 header/middleware changes", async ({ page }) => {
    await page.goto("/staff/ai");
    await expect(page).toHaveURL(/\/staff\/login/);
    await page.goto("/staff/ops");
    await expect(page).toHaveURL(/\/staff\/login/);
  });
});
