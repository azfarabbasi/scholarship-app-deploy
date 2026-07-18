import { describe, expect, it } from "vitest";
import { isScholarlyWidgetPath } from "@/lib/assistant/scholarly-widget-pages";

describe("isScholarlyWidgetPath", () => {
  it("allows the floating widget on every page listed in the brief", () => {
    expect(isScholarlyWidgetPath("/")).toBe(true);
    expect(isScholarlyWidgetPath("/opportunities")).toBe(true);
    expect(isScholarlyWidgetPath("/opportunities/daad-scholarships-for-foreign-students")).toBe(true);
    expect(isScholarlyWidgetPath("/workspace")).toBe(true);
    expect(isScholarlyWidgetPath("/calendar")).toBe(true);
    expect(isScholarlyWidgetPath("/notifications")).toBe(true);
    expect(isScholarlyWidgetPath("/account")).toBe(true);
    expect(isScholarlyWidgetPath("/eligibility")).toBe(true);
    expect(isScholarlyWidgetPath("/compare")).toBe(true);
  });

  it("never allows the widget on staff/admin routes", () => {
    expect(isScholarlyWidgetPath("/staff")).toBe(false);
    expect(isScholarlyWidgetPath("/staff/opportunities")).toBe(false);
    expect(isScholarlyWidgetPath("/staff/login")).toBe(false);
  });

  it("never allows the widget on auth routes", () => {
    expect(isScholarlyWidgetPath("/auth/login")).toBe(false);
    expect(isScholarlyWidgetPath("/auth/signup")).toBe(false);
    expect(isScholarlyWidgetPath("/auth/callback")).toBe(false);
  });

  it("never allows the widget on legal/static content pages", () => {
    expect(isScholarlyWidgetPath("/privacy")).toBe(false);
    expect(isScholarlyWidgetPath("/terms")).toBe(false);
    expect(isScholarlyWidgetPath("/disclaimer")).toBe(false);
    expect(isScholarlyWidgetPath("/security")).toBe(false);
    expect(isScholarlyWidgetPath("/accessibility")).toBe(false);
    expect(isScholarlyWidgetPath("/advertising-policy")).toBe(false);
  });

  it("never allows the widget on sensitive/destructive account sub-pages", () => {
    expect(isScholarlyWidgetPath("/account/delete")).toBe(false);
    expect(isScholarlyWidgetPath("/account/data")).toBe(false);
    expect(isScholarlyWidgetPath("/account/sync")).toBe(false);
    expect(isScholarlyWidgetPath("/account/security")).toBe(false);
  });

  it("never allows the widget on the full assistant pages themselves", () => {
    expect(isScholarlyWidgetPath("/assistant")).toBe(false);
    expect(isScholarlyWidgetPath("/assistant/history")).toBe(false);
    expect(isScholarlyWidgetPath("/assistant/settings")).toBe(false);
    expect(isScholarlyWidgetPath("/workspace/assistant")).toBe(false);
  });
});
