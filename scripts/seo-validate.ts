/**
 * Checkpoint 6: `npm run seo:validate`.
 *
 * Static verification of the SEO implementation — sitemap/robots exist and
 * are wired to the right data source, metadata helpers are used on public
 * pages, noindex rules match between the sitemap/robots exclusions and the
 * middleware enforcement, and structured data exists where documented.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors: string[] = [];
let checksPassed = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    checksPassed += 1;
    return;
  }
  errors.push(message);
}

function read(relativePath: string): string {
  const absolutePath = path.join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}
function exists(relativePath: string): boolean {
  return existsSync(path.join(root, relativePath));
}

// ---------------------------------------------------------------------------
// 1. Sitemap and robots
// ---------------------------------------------------------------------------
check(exists("app/sitemap.ts"), "Missing app/sitemap.ts.");
check(exists("app/robots.ts"), "Missing app/robots.ts.");

const sitemapSource = read("app/sitemap.ts");
const robotsSource = read("app/robots.ts");

check(sitemapSource.includes("getPublishedOpportunities"), "sitemap.ts must source opportunity entries from getPublishedOpportunities() (published-only, same query as the public catalogue) — never a raw table scan that could include drafts.");
check(!/getAllOpportunities|opportunities\.findMany\(\)/.test(sitemapSource), "sitemap.ts must not use an all-records query that could include unpublished opportunities.");

// The noindex prefix list in middleware.ts must match what robots.ts disallows —
// these two mechanisms (header + robots.txt) are meant to agree.
const middlewareSource = read("src/lib/supabase/middleware.ts");
const noindexPrefixMatch = middlewareSource.match(/NOINDEX_PREFIXES\s*=\s*\[([^\]]+)\]/);
const noindexPrefixes = noindexPrefixMatch
  ? noindexPrefixMatch[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean)
  : [];
check(noindexPrefixes.length > 0, "Could not find NOINDEX_PREFIXES in middleware.ts to cross-check against robots.ts.");
for (const prefix of noindexPrefixes) {
  check(robotsSource.includes(`"${prefix}"`), `robots.ts's disallow list is missing "${prefix}", which middleware.ts noindexes — the two must stay in sync.`);
}
for (const prefix of noindexPrefixes) {
  check(!sitemapSource.includes(`"${prefix}"`), `sitemap.ts must not list a route under the noindexed prefix "${prefix}".`);
}

// ---------------------------------------------------------------------------
// 2. Shared metadata helper
// ---------------------------------------------------------------------------
check(exists("src/lib/seo/metadata.ts"), "Missing src/lib/seo/metadata.ts.");
const metadataHelperSource = read("src/lib/seo/metadata.ts");
check(metadataHelperSource.includes("openGraph"), "buildMetadata() must set Open Graph metadata.");
check(metadataHelperSource.includes("twitter"), "buildMetadata() must set Twitter/social card metadata.");
check(metadataHelperSource.includes("alternates"), "buildMetadata() must set a canonical URL.");
check(metadataHelperSource.includes("buildBreadcrumbList"), "Missing buildBreadcrumbList() structured-data helper.");

const PUBLIC_PAGES_EXPECTED_TO_USE_HELPER = [
  "app/page.tsx",
  "app/opportunities/page.tsx",
  "app/opportunities/[slug]/page.tsx",
  "app/about/page.tsx",
  "app/methodology/page.tsx",
  "app/terms/page.tsx",
  "app/disclaimer/page.tsx",
  "app/contact/page.tsx",
  "app/faq/page.tsx",
  "app/status/page.tsx",
  "app/security/page.tsx",
  "app/accessibility/page.tsx",
  "app/advertising-policy/page.tsx",
  "app/data-sources/page.tsx",
  "app/verification-policy/page.tsx",
];
for (const page of PUBLIC_PAGES_EXPECTED_TO_USE_HELPER) {
  check(exists(page), `Missing ${page}.`);
  check(read(page).includes("buildMetadata"), `${page} must build its metadata through buildMetadata() for consistent Open Graph/canonical handling.`);
}

// ---------------------------------------------------------------------------
// 3. Structured data
// ---------------------------------------------------------------------------
check(exists("src/components/common/JsonLd.tsx"), "Missing src/components/common/JsonLd.tsx.");
check(read("app/page.tsx").includes("WebSite") && read("app/page.tsx").includes("Organization"), "Homepage must include WebSite + Organization structured data.");
check(read("app/page.tsx").includes("SearchAction"), "Homepage structured data must include a SearchAction.");
check(read("app/faq/page.tsx").includes("FAQPage"), "The FAQ page must include FAQPage structured data.");
check(
  read("app/opportunities/[slug]/page.tsx").includes("EducationalOccupationalProgram"),
  "The opportunity detail page must include EducationalOccupationalProgram structured data.",
);
check(
  read("app/opportunities/[slug]/page.tsx").includes("countdown.allowed"),
  "Opportunity structured data must only assert applicationDeadline when the same verified+exact gate the UI countdown uses is true — never an estimated or unverified date.",
);

// ---------------------------------------------------------------------------
// 4. Private-page noindex enforcement exists
// ---------------------------------------------------------------------------
check(middlewareSource.includes("X-Robots-Tag") && middlewareSource.includes("noindex"), "middleware.ts must set X-Robots-Tag: noindex for private routes.");

console.log(`seo:validate: ${checksPassed} check(s) passed.`);

if (errors.length > 0) {
  console.error(`\nseo:validate found ${errors.length} problem(s):\n`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("seo:validate: all SEO checks passed.");
