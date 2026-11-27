import { describe, expect, it } from "vitest";
import {
  extractAuditDiff,
  formatAuditValue,
  formatRawAuditJson,
  getActionBadgeVariant,
  humanizeEntity,
  humanizeKey,
  parseAuditDetails,
  summarizeAuditDetails,
} from "./audit-formatter";

describe("audit-formatter", () => {
  it("parses JSON strings, objects, arrays, plain text, and empty values safely", () => {
    expect(parseAuditDetails(null)).toEqual({ kind: "empty" });
    expect(parseAuditDetails("   ")).toEqual({ kind: "empty" });
    expect(parseAuditDetails("Manual export")).toEqual({
      kind: "text",
      text: "Manual export",
    });
    expect(parseAuditDetails('{"runNumber":"PR-001","isActive":true}')).toEqual(
      {
        kind: "structured",
        data: { runNumber: "PR-001", isActive: true },
        raw: { runNumber: "PR-001", isActive: true },
      },
    );
    expect(parseAuditDetails("[1,2]")).toEqual({
      kind: "array",
      data: [1, 2],
      raw: [1, 2],
    });
  });

  it("humanizes keys and entity names", () => {
    expect(humanizeKey("runNumber")).toBe("Run Number");
    expect(humanizeKey("fromRecipeId")).toBe("Source Recipe ID");
    expect(humanizeKey("user_email")).toBe("User Email");
    expect(humanizeEntity("ProductionRun")).toBe("Production Run");
    expect(humanizeEntity("SalesOrder")).toBe("Sales Order");
  });

  it("masks sensitive values and formats booleans and numbers", () => {
    expect(formatAuditValue("super_secret_token_1234", "apiKey")).toBe(
      "••••••••1234",
    );
    expect(formatAuditValue(true, "isActive")).toBe("Yes");
    expect(formatAuditValue(false, "isActive")).toBe("No");
    expect(formatAuditValue(12500, "amount")).toBe("12,500");
  });

  it("extracts before/after diffs with added, removed, and changed fields", () => {
    const diffs = extractAuditDiff({
      before: { name: "Flour A", price: 100, legacyCode: "OLD" },
      after: { name: "Flour A", price: 120, gstRate: 5 },
    });

    expect(diffs).toEqual([
      {
        field: "price",
        label: "Price",
        kind: "changed",
        before: "100",
        after: "120",
      },
      {
        field: "legacyCode",
        label: "Legacy Code",
        kind: "removed",
        before: "OLD",
        after: "",
      },
      {
        field: "gstRate",
        label: "GST Rate",
        kind: "added",
        before: "",
        after: "5",
      },
    ]);
  });

  it("summarizes structured payloads without raw JSON syntax", () => {
    const summary = summarizeAuditDetails(
      JSON.stringify({
        runNumber: "PR-2026-001",
        version: 2,
        isActive: true,
        extra: "ignored-in-preview",
      }),
    );
    expect(summary).toBe(
      "Run Number: PR-2026-001 · Version: 2 · Active: Yes (+1 more)",
    );
    expect(summary).not.toContain("{");
  });

  it("maps actions to semantic badge variants", () => {
    expect(getActionBadgeVariant("CREATE")).toBe("success");
    expect(getActionBadgeVariant("UPDATE")).toBe("info");
    expect(getActionBadgeVariant("REVERSE")).toBe("warning");
    expect(getActionBadgeVariant("DELETE")).toBe("danger");
    expect(getActionBadgeVariant("OTHER")).toBe("neutral");
  });

  it("formats raw JSON cleanly", () => {
    expect(formatRawAuditJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(formatRawAuditJson(null)).toBe("{}");
  });
});
