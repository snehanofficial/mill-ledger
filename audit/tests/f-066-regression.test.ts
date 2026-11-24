import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-066: Outbox Sync Status Badges Text and Icon Pairing (WCAG 2.2 SC 1.4.1 & Master Rulebook Phase 9)", () => {
  const ordersPagePath = path.resolve(__dirname, "../../client/src/pages/orders-page.tsx");
  const outboxSheetPath = path.resolve(__dirname, "../../client/src/components/shell/device-outbox-sheet.tsx");

  it("ensures orders-page outbox badges pair text with accessible visual icons", () => {
    const source = fs.readFileSync(ordersPagePath, "utf8");

    // Queued badge must contain ClockIcon with aria-hidden
    expect(source).toMatch(/ord\.status === "queued"[\s\S]*?<ClockIcon[^>]*aria-hidden="true"[^>]*>[\s\S]*?Waiting to sync/);

    // Syncing badge must contain RefreshCwIcon with spin animation and aria-hidden
    expect(source).toMatch(/ord\.status === "syncing"[\s\S]*?<RefreshCwIcon[^>]*animate-spin[^>]*aria-hidden="true"[^>]*>[\s\S]*?Syncing\.\.\./);

    // Conflict badge must contain AlertTriangleIcon with aria-hidden
    expect(source).toMatch(/ord\.status === "conflict"[\s\S]*?<AlertTriangleIcon[^>]*aria-hidden="true"[^>]*>[\s\S]*?Conflict:/);

    // Synced badge must contain CheckCircle2Icon with aria-hidden
    expect(source).toMatch(/ord\.status === "synced"[\s\S]*?<CheckCircle2Icon[^>]*aria-hidden="true"[^>]*>[\s\S]*?Synced:/);
  });

  it("ensures device-outbox-sheet badges pair text with accessible visual icons", () => {
    const source = fs.readFileSync(outboxSheetPath, "utf8");

    // Queued badge must contain ClockIcon with aria-hidden
    expect(source).toMatch(/ord\.status === "queued"[\s\S]*?<ClockIcon[^>]*aria-hidden="true"[^>]*>/);

    // Syncing badge must contain RefreshCwIcon with spin animation and aria-hidden
    expect(source).toMatch(/ord\.status === "syncing"[\s\S]*?<RefreshCwIcon[^>]*animate-spin[^>]*aria-hidden="true"[^>]*>/);

    // Conflict badge must contain AlertTriangleIcon with aria-hidden
    expect(source).toMatch(/ord\.status === "conflict"[\s\S]*?<AlertTriangleIcon[^>]*aria-hidden="true"[^>]*>/);

    // Synced badge must contain CheckCircle2Icon with aria-hidden
    expect(source).toMatch(/ord\.status === "synced"[\s\S]*?<CheckCircle2Icon[^>]*aria-hidden="true"[^>]*>/);
  });

  it("ensures neither file renders naked text badges for sync status without icons", () => {
    const ordersSource = fs.readFileSync(ordersPagePath, "utf8");
    const outboxSource = fs.readFileSync(outboxSheetPath, "utf8");

    // Check that simple <Badge>Waiting to sync</Badge> without icon does not exist
    expect(ordersSource).not.toMatch(/<Badge[^>]*>\s*Waiting to sync\s*<\/Badge>/);
    expect(ordersSource).not.toMatch(/<Badge[^>]*>\s*Syncing\.\.\.\s*<\/Badge>/);

    expect(outboxSource).not.toMatch(/<Badge[^>]*>\s*\{t\("Waiting to sync"\)\}\s*<\/Badge>/);
    expect(outboxSource).not.toMatch(/<Badge[^>]*>\s*\{t\("Syncing\.\.\."\)\}\s*<\/Badge>/);
  });
});
