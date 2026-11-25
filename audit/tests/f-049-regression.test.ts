import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DOMAIN_GLOSSARY } from "../../client/src/lib/domain-glossary.js";

describe("F-049 Regression Test: In-App Documentation, Onboarding & Domain Jargon Tooltips", () => {
  const repoRoot = path.resolve(__dirname, "../..");

  it("client/src/lib/domain-glossary.ts defines definitions for all core manufacturing and accounting acronyms", () => {
    expect(DOMAIN_GLOSSARY.BOM).toContain("Bill of Materials");
    expect(DOMAIN_GLOSSARY.ATP).toContain("Available to Promise");
    expect(DOMAIN_GLOSSARY.FIFO).toContain("First-In, First-Out");
    expect(DOMAIN_GLOSSARY.YIELD_VARIANCE).toContain("Yield Variance");
    expect(DOMAIN_GLOSSARY.WAC).toContain("Weighted Average Cost");
  });

  it("client/src/components/help/help-guide-modal.tsx provides end-to-end operational documentation", () => {
    const modalSource = fs.readFileSync(
      path.join(repoRoot, "client/src/components/help/help-guide-modal.tsx"),
      "utf8",
    );

    expect(modalSource).toContain("MillLedger Operational Documentation & User Guide");
    expect(modalSource).toContain("1. Inbound Raw Materials & Purchasing");
    expect(modalSource).toContain("2. Batch Production & Recipe Execution");
    expect(modalSource).toContain("3. Sales Booking & Atomic Reservation");
    expect(modalSource).toContain("4. Warehouse Fulfillment & Physical Dispatch");
    expect(modalSource).toContain("5. Invoicing & Statutory GST");
    expect(modalSource).toContain("6. Payments & Collections Ledger");
    expect(modalSource).toContain("BOM (Bill of Materials)");
    expect(modalSource).toContain("ATP (Available to Promise)");
    expect(modalSource).toContain("Field-Ready Offline Operation");
  });

  it("authenticated-shell.tsx integrates documentation triggers in header and avatar dropdowns", () => {
    const shellSource = fs.readFileSync(
      path.join(repoRoot, "client/src/components/shell/authenticated-shell.tsx"),
      "utf8",
    );

    // Help button in header
    expect(shellSource).toContain("Help and Documentation");
    expect(shellSource).toContain("HelpCircleIcon");

    // Documentation & Guide in avatar menu and sidebar menu
    expect(shellSource).toContain("Documentation & Guide");

    // HelpGuideModal integration
    expect(shellSource).toContain("<HelpGuideModal");
  });

  it("production-page.tsx annotates Yield variance and BOM with DomainTooltip", () => {
    const prodSource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/production-page.tsx"),
      "utf8",
    );

    expect(prodSource).toContain("<DomainTooltip term=\"YIELD_VARIANCE\"");
    expect(prodSource).toContain("<DomainTooltip term=\"BOM\"");
  });

  it("reports-page.tsx annotates Yield variance, ATP, and WAC with DomainTooltip", () => {
    const repSource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/reports-page.tsx"),
      "utf8",
    );

    expect(repSource).toContain("<DomainTooltip term=\"YIELD_VARIANCE\"");
    expect(repSource).toContain("<DomainTooltip term=\"ATP\"");
    expect(repSource).toContain("<DomainTooltip term=\"WAC\"");
  });

  it("payments-page.tsx and orders-page.tsx annotate FIFO and ATP with DomainTooltip", () => {
    const paySource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/payments-page.tsx"),
      "utf8",
    );
    const ordSource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/orders-page.tsx"),
      "utf8",
    );

    expect(paySource).toContain("<DomainTooltip term=\"FIFO\"");
    expect(ordSource).toContain("<DomainTooltip term=\"ATP\"");
  });
});
