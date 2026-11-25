import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-055: Interactive Touch Targets (WCAG 2.2 SC 2.5.8 Level AA & Apple HIG)", () => {
  const sidebarPath = path.resolve(__dirname, "../../client/src/components/ui/sidebar.tsx");
  const breadcrumbPath = path.resolve(__dirname, "../../client/src/components/ui/breadcrumb.tsx");
  const buttonPath = path.resolve(__dirname, "../../client/src/components/ui/button.tsx");
  const indexCssPath = path.resolve(__dirname, "../../client/src/index.css");
  const outboxSheetPath = path.resolve(__dirname, "../../client/src/components/shell/device-outbox-sheet.tsx");
  const ordersPagePath = path.resolve(__dirname, "../../client/src/pages/orders-page.tsx");
  const shellPath = path.resolve(__dirname, "../../client/src/components/shell/authenticated-shell.tsx");

  it("ensures SidebarRail pointer target width is at least 24px (WCAG 2.2 SC 2.5.8)", () => {
    const sidebarSource = fs.readFileSync(sidebarPath, "utf8");

    // Match SidebarRail definition
    expect(sidebarSource).toContain("SidebarRail");
    // Ensure w-4 (16px) is replaced with w-6 min-w-6 (24px)
    expect(sidebarSource).not.toMatch(/SidebarRail[\s\S]*?w-4[\s\S]*?cursor-col-resize/);
    expect(sidebarSource).toMatch(/w-6\s+min-w-6/);
  });

  it("ensures BreadcrumbLink targets have minimum 24px target height", () => {
    const breadcrumbSource = fs.readFileSync(breadcrumbPath, "utf8");

    expect(breadcrumbSource).toContain("min-h-6");
    expect(breadcrumbSource).toContain("min-w-6");
  });

  it("ensures button component includes touch-manipulation for fast and reliable touch response", () => {
    const buttonSource = fs.readFileSync(buttonPath, "utf8");

    expect(buttonSource).toContain("touch-manipulation");
  });

  it("ensures .touch-target utility is defined in index.css with 44x44px touch dimensions (Apple HIG)", () => {
    const cssSource = fs.readFileSync(indexCssPath, "utf8");

    expect(cssSource).toContain(".touch-target");
    expect(cssSource).toContain("min-height: 44px;");
    expect(cssSource).toContain("min-width: 44px;");
  });

  it("ensures compact table and outbox action buttons do not use sub-24px touch targets", () => {
    const outboxSource = fs.readFileSync(outboxSheetPath, "utf8");
    const ordersSource = fs.readFileSync(ordersPagePath, "utf8");
    const shellSource = fs.readFileSync(shellPath, "utf8");

    // No buttons should have h-6 (24px without padding) or size-7 (28px icon button)
    expect(outboxSource).not.toContain('"h-6 px-2 text-2xs gap-1"');
    expect(ordersSource).not.toContain('"h-6 px-2 text-2xs gap-1"');
    expect(shellSource).not.toContain('className="size-7 text-muted-foreground hover:text-destructive"');

    // Should use h-8 with min-h/min-w expansion
    expect(outboxSource).toContain("min-h-[32px]");
    expect(ordersSource).toContain("min-h-[32px]");
    expect(shellSource).toContain("size-8 min-h-8 min-w-8");
  });
});
