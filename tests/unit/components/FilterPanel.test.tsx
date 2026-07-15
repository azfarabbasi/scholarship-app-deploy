import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterPanel } from "@/components/opportunities/FilterPanel";
import { DEFAULT_CATALOGUE_FILTERS } from "@/lib/catalogue/search";

const options = {
  countries: ["Germany", "France"],
  regions: ["EU-wide"],
  studyLevels: ["Master", "PhD"],
  opportunityTypes: ["scholarship"],
};

describe("FilterPanel", () => {
  it("renders accessible, labelled checkboxes for each filter dimension", () => {
    render(<FilterPanel options={options} filters={DEFAULT_CATALOGUE_FILTERS} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Germany" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Shortlisted only" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Master" })).toBeInTheDocument();
  });

  it("calls onChange with an updated filter set when a checkbox is toggled", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterPanel options={options} filters={DEFAULT_CATALOGUE_FILTERS} onChange={handleChange} />);

    await user.click(screen.getByRole("checkbox", { name: "Germany" }));

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ countries: ["Germany"] }),
    );
  });

  it("reset button restores defaults while preserving the search query", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterPanel
        options={options}
        filters={{ ...DEFAULT_CATALOGUE_FILTERS, countries: ["Germany"], query: "scholarship" }}
        onChange={handleChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(handleChange).toHaveBeenCalledWith({ ...DEFAULT_CATALOGUE_FILTERS, query: "scholarship" });
  });
});
