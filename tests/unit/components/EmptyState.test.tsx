import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/common/EmptyState";

describe("EmptyState", () => {
  it("renders a title and description", () => {
    render(<EmptyState title="No opportunities match your filters" description="Try removing a filter." />);
    expect(screen.getByText("No opportunities match your filters")).toBeInTheDocument();
    expect(screen.getByText("Try removing a filter.")).toBeInTheDocument();
  });

  it("renders an optional action", () => {
    render(<EmptyState title="Empty" action={<button type="button">Reset</button>} />);
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });
});
