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

/** Bounded slice from a marker, tolerant of either LF or CRLF line endings — a smoke test, not a CSS parser. */
function sliceFrom(marker: string, length = 1800): string {
  const start = css.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, start + length);
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
});
