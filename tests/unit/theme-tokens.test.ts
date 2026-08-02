import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the green-first Scholarly rebrand theme (see
 * docs/ui-polish/scholarly-frontend-polish.md): asserts the CSS custom
 * properties directly, rather than rendering a component, so it fails loudly
 * if a future edit reverts the brand tokens back toward blue or drops the
 * light/dark/system-preference blocks out of sync with each other.
 */
const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

/**
 * Phase 5 (launch-audit remediation): the PWA manifest and every icon file
 * (favicon, Apple touch icon, the three manifest PNG icons) still hard-coded
 * the pre-rebrand blue (`#185ada`) — this test file's own docstring above
 * claimed the blue values "never reappear," but that assertion only ever
 * read `globals.css`, never these files, so the regression went undetected.
 * Read every one directly, the same way, so this can't happen silently again.
 */
const BRAND_ICON_FILES = [
  "app/manifest.ts",
  "app/icon.tsx",
  "app/apple-icon.tsx",
  "app/icon-192.png/route.tsx",
  "app/icon-512.png/route.tsx",
  "app/icon-512-maskable.png/route.tsx",
] as const;

function readProjectFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), ...relativePath.split("/")), "utf8");
}

/**
 * Returns the whole `{ … }` block that starts at `marker`, by matching braces
 * rather than taking a fixed-length slice.
 *
 * This used to grab a flat 1800 characters, which silently coupled the test to
 * how *long* a theme block happened to be: adding tokens or comments pushed
 * later declarations out of the window and failed the assertion even though the
 * token was present and correct. Brace matching keeps the same guarantee
 * without caring about block size. Still a smoke test, not a CSS parser —
 * it assumes braces inside the block are balanced, which holds for plain
 * custom-property declarations and for the one nested `@media` block below.
 */
function sliceFrom(marker: string): string {
  const start = css.indexOf(marker);
  expect(start, `marker not found in globals.css: ${marker}`).toBeGreaterThanOrEqual(0);

  const open = css.indexOf("{", start);
  expect(open, `no opening brace after marker: ${marker}`).toBeGreaterThanOrEqual(0);

  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }

  throw new Error(`unbalanced braces after marker: ${marker}`);
}

describe("theme tokens (green-first Scholarly rebrand)", () => {
  it("never reintroduces the old blue brand color", () => {
    expect(css).not.toContain("#185ada");
    expect(css).not.toContain("#123f99");
    expect(css).not.toContain("#6ba1f5");
  });

  it("sets a WCAG AA-passing green brand color in the light theme (:root)", () => {
    const root = sliceFrom(":root {");
    expect(root).toContain("--color-brand: #047857");
    expect(root).toContain("--color-focus-ring: #047857");
  });

  it("sets a WCAG AA-passing green brand color in the explicit dark theme block", () => {
    const dark = sliceFrom('.dark {');
    expect(dark).toContain("--color-brand: #34d399");
    expect(dark).toContain("--color-focus-ring: #34d399");
  });

  it("keeps the prefers-color-scheme fallback in sync with the explicit dark theme", () => {
    const systemDark = sliceFrom("@media (prefers-color-scheme: dark)");
    expect(systemDark).toContain("--color-brand: #34d399");
  });

  it("registers a mint secondary-accent token in both themes and the Tailwind theme map", () => {
    expect(css).toMatch(/--color-mint: #0d9488/);
    expect(css).toMatch(/--color-mint: #5eead4/);
    expect(css).toContain("--color-mint: var(--color-mint);");
  });

  it("never changes the existing semantic status colors (success/warning/danger/info/neutral)", () => {
    // These already matched the brief's semantic color rules before the
    // rebrand and must stay untouched — only brand/accent tokens changed.
    expect(css).toContain("--color-success: #0f7a3d");
    expect(css).toContain("--color-warning: #875f09");
    expect(css).toContain("--color-danger: #b3261e");
    expect(css).toContain("--color-info: #0b5fae");
  });

  describe("PWA manifest and icons (Phase 5: blue→green branding)", () => {
    it.each(BRAND_ICON_FILES)("%s never reintroduces the old blue brand color", (relativePath) => {
      const source = readProjectFile(relativePath);
      expect(source).not.toContain("#185ada");
      expect(source).not.toContain("#123f99");
      expect(source).not.toContain("#6ba1f5");
    });

    it.each(BRAND_ICON_FILES)("%s uses the current green brand color", (relativePath) => {
      const source = readProjectFile(relativePath);
      expect(source).toContain("#047857");
    });
  });
});
