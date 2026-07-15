import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveAnnouncerProvider } from "@/components/common/LiveAnnouncer";
import { OfflineBanner } from "@/components/layout/OfflineBanner";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

afterEach(() => {
  setOnline(true);
});

describe("OfflineBanner", () => {
  it("shows nothing while online", () => {
    setOnline(true);
    render(
      <LiveAnnouncerProvider>
        <OfflineBanner />
      </LiveAnnouncerProvider>,
    );
    expect(screen.queryByText(/you.re offline/i)).toBeNull();
  });

  it("shows an offline notice, with text (not colour) conveying the status, when offline", () => {
    setOnline(false);
    render(
      <LiveAnnouncerProvider>
        <OfflineBanner />
      </LiveAnnouncerProvider>,
    );
    expect(screen.getByText(/you.re offline/i)).toBeInTheDocument();
    expect(screen.getByText(/still works/i)).toBeInTheDocument();
  });
});
