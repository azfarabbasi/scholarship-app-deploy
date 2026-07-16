import { describe, expect, it } from "vitest";
import { escapeCsvFormulaInjection, buildCsv } from "@/lib/csv/export";
import { CsvParseError, parseCsv, parseCsvTable, CSV_MAX_ROWS } from "@/lib/csv/parse";
import {
  OPPORTUNITY_CSV_COLUMNS,
  buildOpportunityCsvTemplate,
  opportunityCsvRowSchema,
  splitSemicolonList,
} from "@/lib/csv/opportunity-import";

describe("parseCsv", () => {
  it("parses a simple comma-separated file", () => {
    const rows = parseCsv("a,b,c\n1,2,3\n");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas and escaped quotes", () => {
    const rows = parseCsv('title,note\n"Hello, world","She said ""hi"""\n');
    expect(rows).toEqual([
      ["title", "note"],
      ["Hello, world", 'She said "hi"'],
    ]);
  });

  it("handles CRLF and a trailing newline without an extra empty row", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("throws CsvParseError for an unterminated quoted field", () => {
    expect(() => parseCsv('a,"unterminated\n1,2\n')).toThrow(CsvParseError);
  });
});

describe("parseCsvTable", () => {
  it("only keeps allowed columns, silently dropping unexpected ones (no prototype pollution surface)", () => {
    const text = "title,__proto__,constructor,extra\nHello,x,y,z\n";
    const table = parseCsvTable(text, ["title"]);
    expect(table.headers).toEqual(["title"]);
    expect(table.rows).toEqual([{ title: "Hello" }]);
    expect(Object.getPrototypeOf(table.rows[0])).toBe(Object.prototype);
  });

  it("rejects a file with more rows than CSV_MAX_ROWS", () => {
    const header = "title\n";
    const body = Array.from({ length: CSV_MAX_ROWS + 1 }, () => "x").join("\n");
    expect(() => parseCsvTable(header + body, ["title"])).toThrow(CsvParseError);
  });

  it("rejects an empty file", () => {
    expect(() => parseCsvTable("", ["title"])).toThrow(CsvParseError);
  });
});

describe("escapeCsvFormulaInjection", () => {
  it("prefixes a leading = + - @ with a single quote", () => {
    expect(escapeCsvFormulaInjection("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvFormulaInjection("+1234")).toBe("'+1234");
    expect(escapeCsvFormulaInjection("-1234")).toBe("'-1234");
    expect(escapeCsvFormulaInjection("@cmd")).toBe("'@cmd");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeCsvFormulaInjection("Ordinary Title")).toBe("Ordinary Title");
  });
});

describe("buildCsv", () => {
  it("quotes cells containing commas/newlines and escapes embedded quotes", () => {
    const csv = buildCsv(["a", "b"], [["has,comma", 'has "quote"']]);
    expect(csv).toContain('"has,comma"');
    expect(csv).toContain('"has ""quote"""');
  });

  it("escapes formula-injection attempts even inside exported cells", () => {
    const csv = buildCsv(["title"], [["=cmd|'/c calc'!A1"]]);
    expect(csv).toContain("'=cmd");
  });
});

describe("opportunityCsvRowSchema", () => {
  const validRow = {
    title: "Example Scholarship",
    summary: "A summary.",
    opportunityTypeCode: "scholarship",
    organisationName: "Example University",
    providerName: "Example Office",
    countries: "Germany;France",
    studyLevels: "Master;PhD",
    officialWebsiteUrl: "https://example.edu",
    applicationUrl: "https://example.edu/apply",
    benefitSummary: "Full funding.",
    eligibilitySummary: "Open to all.",
    deadlinePrecision: "exact",
    deadlineDate: "2027-03-15",
    deadlineRawText: "March 15, 2027",
    sourceUrl: "https://example.edu",
    sourceOrganisationName: "Example University",
    sourceLastCheckedAt: "2027-01-01",
  };

  it("accepts a fully valid row", () => {
    expect(opportunityCsvRowSchema.safeParse(validRow).success).toBe(true);
  });

  it("rejects an invalid URL", () => {
    const result = opportunityCsvRowSchema.safeParse({ ...validRow, sourceUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed deadline date", () => {
    const result = opportunityCsvRowSchema.safeParse({ ...validRow, deadlineDate: "15/03/2027" });
    expect(result.success).toBe(false);
  });

  it("requires deadlineDate for exact/estimated precision", () => {
    const result = opportunityCsvRowSchema.safeParse({ ...validRow, deadlineDate: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a deadlineDate for rolling/unknown precision", () => {
    const result = opportunityCsvRowSchema.safeParse({
      ...validRow,
      deadlinePrecision: "rolling",
      deadlineDate: "2027-03-15",
    });
    expect(result.success).toBe(false);
  });

  it("accepts rolling precision with an empty deadlineDate", () => {
    const result = opportunityCsvRowSchema.safeParse({ ...validRow, deadlinePrecision: "rolling", deadlineDate: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { title, ...rest } = validRow;
    void title;
    expect(opportunityCsvRowSchema.safeParse(rest).success).toBe(false);
  });
});

describe("splitSemicolonList", () => {
  it("trims and filters empty entries", () => {
    expect(splitSemicolonList(" Germany ; France ;; Poland")).toEqual(["Germany", "France", "Poland"]);
  });
});

describe("buildOpportunityCsvTemplate", () => {
  it("produces a header row matching OPPORTUNITY_CSV_COLUMNS and one example row that itself validates", () => {
    const template = buildOpportunityCsvTemplate();
    const table = parseCsvTable(template, OPPORTUNITY_CSV_COLUMNS);
    expect(table.headers).toEqual([...OPPORTUNITY_CSV_COLUMNS]);
    expect(table.rows).toHaveLength(1);
    expect(opportunityCsvRowSchema.safeParse(table.rows[0]).success).toBe(true);
  });
});
