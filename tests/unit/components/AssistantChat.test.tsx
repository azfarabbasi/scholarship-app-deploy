import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { LiveAnnouncerProvider } from "@/components/common/LiveAnnouncer";
import { useAssistantChat } from "@/hooks/useAssistantChat";

vi.mock("@/hooks/useAssistantChat");

function baseChatState(overrides: Record<string, unknown> = {}) {
  return {
    messages: [],
    pending: false,
    statusKind: null,
    statusText: null,
    remainingQuota: null,
    temporary: false,
    setTemporary: vi.fn(),
    sendMessage: vi.fn(),
    giveFeedback: vi.fn(),
    ...overrides,
  };
}

describe("AssistantChat", () => {
  it("fills (but does not send) the input when a suggested prompt chip is clicked", async () => {
    const sendMessage = vi.fn();
    vi.mocked(useAssistantChat).mockReturnValue(baseChatState({ sendMessage }) as ReturnType<typeof useAssistantChat>);
    const user = userEvent.setup();

    render(
      <LiveAnnouncerProvider>
        <AssistantChat studentProfileId={null} scope="general" suggestedPrompts={["What is Scholarly?"]} />
      </LiveAnnouncerProvider>,
    );

    await user.click(screen.getByRole("button", { name: "What is Scholarly?" }));
    expect(screen.getByRole("textbox")).toHaveValue("What is Scholarly?");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("hides the temporary-chat checkbox in compact mode", () => {
    vi.mocked(useAssistantChat).mockReturnValue(baseChatState() as ReturnType<typeof useAssistantChat>);
    render(
      <LiveAnnouncerProvider>
        <AssistantChat studentProfileId={null} scope="general" compact defaultTemporary />
      </LiveAnnouncerProvider>,
    );
    expect(screen.queryByText(/temporary chat/i)).not.toBeInTheDocument();
  });

  it("shows the temporary-chat checkbox by default (non-compact)", () => {
    vi.mocked(useAssistantChat).mockReturnValue(baseChatState() as ReturnType<typeof useAssistantChat>);
    render(
      <LiveAnnouncerProvider>
        <AssistantChat studentProfileId={null} scope="general" />
      </LiveAnnouncerProvider>,
    );
    expect(screen.getByText(/temporary chat/i)).toBeInTheDocument();
  });

  it("labels assistant replies with the Scholarly identity", () => {
    vi.mocked(useAssistantChat).mockReturnValue(
      baseChatState({
        messages: [
          { id: "1", role: "assistant", content: "Here is an answer.", citations: [] },
        ],
      }) as ReturnType<typeof useAssistantChat>,
    );
    render(
      <LiveAnnouncerProvider>
        <AssistantChat studentProfileId={null} scope="general" />
      </LiveAnnouncerProvider>,
    );
    expect(screen.getByText("Scholarly")).toBeInTheDocument();
    expect(screen.getByText("Here is an answer.")).toBeInTheDocument();
  });
});
