import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "@/components/layout/Header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/opportunities",
}));

describe("Header navigation", () => {
  it("renders the ScholarTrack brand and primary navigation links", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: /ScholarTrack/i })).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("marks the current page with aria-current", () => {
    render(<Header />);
    const activeLink = screen.getByRole("link", { name: "Opportunities" });
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("exposes an accessible, keyboard-operable mobile menu toggle", () => {
    render(<Header />);
    const toggle = screen.getByRole("button", { name: /open menu/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "mobile-navigation");
  });
});
