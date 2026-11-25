import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-047 Regression Test: Sticky Table Headers & Mobile Card Transformations", () => {
  const repoRoot = path.resolve(__dirname, "../..");

  it("client/src/components/ui/table.tsx defines sticky header and non-transparent head cells", () => {
    const tableSource = fs.readFileSync(
      path.join(repoRoot, "client/src/components/ui/table.tsx"),
      "utf8",
    );

    // Assert TableHeader has sticky positioning and backdrop blur
    expect(tableSource).toContain("sticky top-0 z-10");
    expect(tableSource).toContain("bg-background/95");
    expect(tableSource).toContain("backdrop-blur-xs");

    // Assert TableHead has background to prevent scrolling text bleeding through
    expect(tableSource).toContain("bg-background/95");
  });

  it("orders-page.tsx renders mobile cards (<md) and desktop table (md+)", () => {
    const pageSource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/orders-page.tsx"),
      "utf8",
    );

    // Assert mobile cards container exists with responsive visibility
    expect(pageSource).toContain('data-slot="mobile-cards"');
    expect(pageSource).toContain('className="divide-y divide-border md:hidden"');
    expect(pageSource).toContain('className="hidden md:block overflow-x-auto"');

    // Assert mobile touch targets meet 44px minimum requirement (Apple HIG / WCAG 2.2 SC 2.5.8)
    expect(pageSource).toContain("min-h-[44px]");
  });

  it("invoices-page.tsx renders mobile cards (<md) and desktop table (md+)", () => {
    const pageSource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/invoices-page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('data-slot="mobile-cards"');
    expect(pageSource).toContain('className="divide-y divide-border md:hidden"');
    expect(pageSource).toContain('className="hidden md:block overflow-x-auto"');
    expect(pageSource).toContain("min-h-[44px]");
  });

  it("payments-page.tsx renders mobile cards (<md) for both payments and receivables", () => {
    const pageSource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/payments-page.tsx"),
      "utf8",
    );

    // Both views have mobile card layout
    const occurrences = (pageSource.match(/data-slot="mobile-cards"/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);

    expect(pageSource).toContain('className="hidden md:block overflow-x-auto"');
    expect(pageSource).toContain("min-h-[44px]");
  });

  it("stock-page.tsx renders mobile cards (<md) and desktop table (md+)", () => {
    const pageSource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/stock-page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('data-slot="mobile-cards"');
    expect(pageSource).toContain('className="divide-y divide-border md:hidden"');
    expect(pageSource).toContain('className="hidden md:block overflow-x-auto"');
  });

  it("dispatch-page.tsx renders mobile cards (<md) and desktop table (md+)", () => {
    const pageSource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/dispatch-page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('data-slot="mobile-cards"');
    expect(pageSource).toContain('className="divide-y divide-border md:hidden"');
    expect(pageSource).toContain('className="hidden md:block overflow-x-auto"');
  });
});
