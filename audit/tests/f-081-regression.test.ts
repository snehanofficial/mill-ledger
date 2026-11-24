import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-081 Regression Test: Device Outbox Order Discard Confirmation Safeguard (Error Prevention)", () => {
  const sheetPath = path.resolve(
    __dirname,
    "../../client/src/components/shell/device-outbox-sheet.tsx",
  );

  it("verifies DeviceOutboxSheet requires explicit ConfirmationDialog before discarding offline orders", () => {
    const source = fs.readFileSync(sheetPath, "utf8");

    // Must import ConfirmationDialog
    expect(source).toContain('import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"');

    // Must have state for tracking order to discard
    expect(source).toContain("const [orderToDiscard, setOrderToDiscard] = useState<OfflineOrder | null>(null)");

    // Discard button must open confirmation dialog, NOT directly call removeOrder
    expect(source).toContain("onClick={() => setOrderToDiscard(ord)}");
    expect(source).not.toContain("onClick={() => removeOrder(ord.id)}");

    // ConfirmationDialog must display warning, customer, and destructive confirmation action
    expect(source).toContain("title={");
    expect(source).toContain("Discard Offline Order");
    expect(source).toContain("Warning: This uncommitted order exists only in your local device storage. Discarding will permanently erase it and it cannot be recovered.");
    expect(source).toContain('confirmLabel="Yes, Discard Order"');
    expect(source).toContain('cancelLabel="Keep Order"');
    expect(source).toContain("destructive");

    // onConfirm must perform removal
    expect(source).toContain("removeOrder(orderToDiscard.id)");
  });
});
