import { describe, expect, it } from "vitest";
import { escapeJsonLd } from "@/components/common/JsonLd";
import { isHttpUrl } from "@/lib/security/url";

describe("escapeJsonLd", () => {
  it("escapes a literal </script> breakout attempt embedded in a JSON string value", () => {
    const malicious = JSON.stringify({ name: '</script><script>alert(1)</script>' });
    const escaped = escapeJsonLd(malicious);
    expect(escaped).not.toContain("</script>");
    expect(escaped).not.toContain("<");
  });

  it("round-trips back to the original data through JSON.parse", () => {
    const data = { name: "Scholarship <Program>", url: "https://example.test/a<b" };
    const escaped = escapeJsonLd(JSON.stringify(data));
    expect(JSON.parse(escaped)).toEqual(data);
  });

  it("leaves JSON with no '<' characters unchanged", () => {
    const json = JSON.stringify({ name: "Plain title", url: "https://example.test" });
    expect(escapeJsonLd(json)).toBe(json);
  });
});

describe("isHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isHttpUrl("https://example.test/page")).toBe(true);
    expect(isHttpUrl("http://example.test")).toBe(true);
  });

  it("rejects javascript:, data:, and other dangerous schemes", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects a malformed or relative value", () => {
    expect(isHttpUrl("not a url")).toBe(false);
    expect(isHttpUrl("/relative/path")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});
