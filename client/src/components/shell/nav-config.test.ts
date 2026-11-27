import { describe, expect, it } from "vitest";
import { getActiveNavHref, getNavSections } from "./nav-config";

describe("getActiveNavHref", () => {
  it("highlights only /orders/new and not /orders for SALESMAN on /orders/new", () => {
    const sections = getNavSections("SALESMAN");
    expect(getActiveNavHref(sections, "/orders/new")).toBe("/orders/new");
  });

  it("highlights /orders for SALESMAN on /orders and detail routes like /orders/123", () => {
    const sections = getNavSections("SALESMAN");
    expect(getActiveNavHref(sections, "/orders")).toBe("/orders");
    expect(getActiveNavHref(sections, "/orders/123")).toBe("/orders");
  });

  it("highlights only the specific report and not /reports for ACCOUNTANT", () => {
    const sections = getNavSections("ACCOUNTANT");
    expect(getActiveNavHref(sections, "/reports")).toBe("/reports");
    expect(getActiveNavHref(sections, "/reports/sales")).toBe("/reports/sales");
    expect(getActiveNavHref(sections, "/reports/gst")).toBe("/reports/gst");
  });

  it("highlights only the nested report child and not Reporting home for ADMIN and OWNER", () => {
    for (const role of ["ADMIN", "OWNER"] as const) {
      const sections = getNavSections(role);
      expect(getActiveNavHref(sections, "/reports")).toBe("/reports");
      expect(getActiveNavHref(sections, "/reports/sales")).toBe(
        "/reports/sales",
      );
      expect(getActiveNavHref(sections, "/reports/audit")).toBe(
        "/reports/audit",
      );
    }
  });

  it("highlights the matching production route for PRODUCTION", () => {
    const sections = getNavSections("PRODUCTION");
    expect(getActiveNavHref(sections, "/production/today")).toBe(
      "/production/today",
    );
    expect(getActiveNavHref(sections, "/production/new")).toBe(
      "/production/new",
    );
    expect(getActiveNavHref(sections, "/production/recipes/42")).toBe(
      "/production/recipes",
    );
  });
});
