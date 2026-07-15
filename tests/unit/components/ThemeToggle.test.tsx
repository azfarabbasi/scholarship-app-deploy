import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const setTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme }),
}));

describe("ThemeToggle", () => {
  it("offers light, dark, and system options as a radio group", () => {
    render(<ThemeToggle />);
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /light theme/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /dark theme/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /system theme/i })).toBeInTheDocument();
  });

  it("calls setTheme when an option is chosen", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("radio", { name: /dark theme/i }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
