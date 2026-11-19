import { describe, expect, it } from "vitest";
import { dueAtFor, escalationThreshold, isOverdue, SLA_HOURS } from "@/domain/sla";
import { csvCell, toCsv } from "@/domain/csv";

describe("SLA", () => {
  const start = new Date("2026-11-01T00:00:00Z");

  it("derives the due date from the priority", () => {
    expect(dueAtFor("URGENT", start).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(dueAtFor("MEDIUM", start).toISOString()).toBe("2026-11-08T00:00:00.000Z");
    expect(SLA_HOURS.LOW).toBe(14 * 24);
  });

  it("flags only open complaints past their due date", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    const dueAt = new Date("2026-11-09T00:00:00Z");
    expect(isOverdue({ dueAt, status: "PENDING" }, now)).toBe(true);
    expect(isOverdue({ dueAt, status: "IN_PROGRESS" }, now)).toBe(true);
    expect(isOverdue({ dueAt, status: "RESOLVED" }, now)).toBe(false);
    expect(isOverdue({ dueAt: new Date("2026-11-11T00:00:00Z"), status: "PENDING" }, now)).toBe(false);
  });

  it("escalates 24 hours after the due date", () => {
    expect(escalationThreshold(new Date("2026-11-10T12:00:00Z")).toISOString()).toBe("2026-11-09T12:00:00.000Z");
  });
});

describe("CSV export", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+92 300")).toBe("'+92 300");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("Lab 3, Block B")).toBe('"Lab 3, Block B"');
    expect(csvCell('He said "no"')).toBe('"He said ""no"""');
  });

  it("writes CRLF rows with a header", () => {
    expect(toCsv(["a", "b"], [[1, null]])).toBe("a,b\r\n1,\r\n");
  });
});
