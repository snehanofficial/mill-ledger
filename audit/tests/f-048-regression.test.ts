import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-048 Regression Test: Confirmation Dialogs for Irreversible Operations", () => {
  const repoRoot = path.resolve(__dirname, "../..");

  it("client/src/components/ui/confirmation-dialog.tsx exports an accessible ConfirmationDialog with AlertDialog backing", () => {
    const dialogSource = fs.readFileSync(
      path.join(repoRoot, "client/src/components/ui/confirmation-dialog.tsx"),
      "utf8",
    );

    expect(dialogSource).toContain("export { ConfirmationDialog }");
    expect(dialogSource).toContain("AlertDialogContent");
    expect(dialogSource).toContain("AlertDialogTitle");
    expect(dialogSource).toContain("AlertDialogDescription");
    expect(dialogSource).toContain("AlertDialogAction");
    expect(dialogSource).toContain("AlertDialogCancel");
    expect(dialogSource).toContain("destructive");
  });

  it("dispatch-page.tsx intercepts dispatch submission with a confirmation dialog warning of permanent stock deduction", () => {
    const dispatchSource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/dispatch-page.tsx"),
      "utf8",
    );

    // Assert ConfirmationDialog is imported and used
    expect(dispatchSource).toContain('from "@/components/ui/confirmation-dialog"');
    expect(dispatchSource).toContain("showConfirmDispatchDialog");
    expect(dispatchSource).toContain("setShowConfirmDispatchDialog(true)");
    expect(dispatchSource).toContain("<ConfirmationDialog");

    // Assert explicit consequence language is present (NN/g H5 & F-048 expected spec)
    expect(dispatchSource).toContain("Confirm Physical Dispatch?");
    expect(dispatchSource).toContain("permanently deduct finished goods from physical");
    expect(dispatchSource).toContain("immutable dispatch record");
    expect(dispatchSource).toContain("cannot be undone");
  });

  it("orders-page.tsx guards irreversible order rejection with ConfirmationDialog and consequence notice", () => {
    const ordersSource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/orders-page.tsx"),
      "utf8",
    );

    // Assert ConfirmationDialog is imported and used for rejection
    expect(ordersSource).toContain('from "@/components/ui/confirmation-dialog"');
    expect(ordersSource).toContain('actionType === "REJECT"');
    expect(ordersSource).toContain("<ConfirmationDialog");

    // Assert explicit business consequence warnings
    expect(ordersSource).toContain("Confirm Sales Order Rejection?");
    expect(ordersSource).toContain("permanently cancel order");
    expect(ordersSource).toContain("release all stock reservations back to inventory");
    expect(ordersSource).toContain("This action is irreversible");
    expect(ordersSource).toContain("Reason for rejection");
  });
});
