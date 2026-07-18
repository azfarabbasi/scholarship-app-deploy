import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScholarlyWidget } from "@/components/assistant/ScholarlyWidget";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));

// The compact chat surface itself (guest/cloud persistence, provider calls,
// citations, etc.) is covered elsewhere (AssistantChat is the same component
// used — and tested end-to-end — on the full /assistant page). This widget's
// own responsibility is page-gating and open/close accessibility, so the
// chat is stubbed to keep this test focused on that.
vi.mock("@/components/assistant/AssistantChat", () => ({
  AssistantChat: () => <div data-testid="scholarly-chat-stub" />,
}));

describe("ScholarlyWidget", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("does not render anything on a page outside the allowlist (e.g. staff)", () => {
    vi.mocked(usePathname).mockReturnValue("/staff");
    const { container } = render(<ScholarlyWidget aiAvailable={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the launcher button on an allowed page", () => {
    render(<ScholarlyWidget aiAvailable={true} />);
    const launcher = screen.getByRole("button", { name: "Ask Scholarly" });
    expect(launcher).toBeInTheDocument();
    expect(launcher).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the panel on click and closes it via the dedicated close button", async () => {
    const user = userEvent.setup();
    render(<ScholarlyWidget aiAvailable={true} />);

    await user.click(screen.getByRole("button", { name: "Ask Scholarly" }));
    expect(screen.getByRole("dialog", { name: "Scholarly quick assistant" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close Scholarly" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the panel when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<ScholarlyWidget aiAvailable={true} />);

    await user.click(screen.getByRole("button", { name: "Ask Scholarly" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a friendly disabled message instead of chat when AI is not enabled", async () => {
    const user = userEvent.setup();
    render(<ScholarlyWidget aiAvailable={false} />);

    await user.click(screen.getByRole("button", { name: "Ask Scholarly" }));
    expect(screen.getByText(/scholarly is not enabled yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId("scholarly-chat-stub")).not.toBeInTheDocument();
  });

  it("renders the compact chat and a link to the full assistant when AI is available", async () => {
    const user = userEvent.setup();
    render(<ScholarlyWidget aiAvailable={true} />);

    await user.click(screen.getByRole("button", { name: "Ask Scholarly" }));
    expect(screen.getByTestId("scholarly-chat-stub")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the full scholarly assistant/i })).toHaveAttribute(
      "href",
      "/assistant",
    );
  });
});
