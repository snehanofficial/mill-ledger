import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpenIcon,
  WorkflowIcon,
  HelpCircleIcon,
  WifiOffIcon,
  CheckCircle2Icon,
  PackageIcon,
  FactoryIcon,
  ShoppingCartIcon,
  TruckIcon,
  ReceiptIcon,
  CreditCardIcon,
} from "lucide-react";

export interface HelpGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpGuideModal({ open, onOpenChange }: HelpGuideModalProps) {
  const [activeTab, setActiveTab] = useState<"workflow" | "glossary" | "offline">(
    "workflow",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <BookOpenIcon className="h-5 w-5 text-primary" />
            <DialogTitle className="text-xl font-bold text-foreground">
              MillLedger Operational Documentation & User Guide
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Standard operating procedures, manufacturing workflows, and domain terminology for food mill operations.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="mt-4 flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("workflow")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === "workflow"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <WorkflowIcon className="h-4 w-4" />
            Operational Workflow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("glossary")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === "glossary"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <HelpCircleIcon className="h-4 w-4" />
            Domain Glossary & Jargon
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("offline")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === "offline"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <WifiOffIcon className="h-4 w-4" />
            Offline Mode & PWA
          </button>
        </div>

        {/* Tab 1: Workflow */}
        {activeTab === "workflow" && (
          <div className="mt-4 space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              MillLedger enforces an immutable, traceable end-to-end ledger across seven core phases. Inventory balances and financial entries cannot be manually overwritten.
            </p>

            <div className="grid gap-3">
              <div className="rounded-lg border bg-card p-3 shadow-2xs">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <PackageIcon className="h-4 w-4 text-amber-500" />
                  <span>1. Inbound Raw Materials & Purchasing</span>
                </div>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  Record purchase receipts with supplier GSTIN and rate. Raw material stock is added, and the item&apos;s Weighted Average Cost (WAC) is recalculated perpetually without altering past records.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-3 shadow-2xs">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <FactoryIcon className="h-4 w-4 text-emerald-500" />
                  <span>2. Batch Production & Recipe Execution</span>
                </div>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  Execute batches against standard Bill of Materials (BOM) recipes. Raw materials (flour, oil, spices, packaging) are consumed, and good finished packets are credited to finished stock. Consumption and yield variances (&gt;5%) are automatically highlighted.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-3 shadow-2xs">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ShoppingCartIcon className="h-4 w-4 text-blue-500" />
                  <span>3. Sales Booking & Atomic Reservation</span>
                </div>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  Field salesmen submit customer orders (online or offline). Approving an order verifies Available-To-Promise (ATP) stock and atomically locks stock reservations, preventing concurrent overselling.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-3 shadow-2xs">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <TruckIcon className="h-4 w-4 text-indigo-500" />
                  <span>4. Warehouse Fulfillment & Physical Dispatch</span>
                </div>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  When goods leave the mill gate, warehouse staff record a dispatch with vehicle and driver details. This irrevocably deducts physical finished goods inventory and releases active reservations.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-3 shadow-2xs">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <ReceiptIcon className="h-4 w-4 text-violet-500" />
                  <span>5. Invoicing & Statutory GST</span>
                </div>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  Generate sequentially numbered tax invoices with exact financial year identifiers (e.g. 2026-27). Intra-state orders charge CGST (2.5%) and SGST (2.5%); inter-state orders charge IGST (5.0%). Posted invoices are immutable.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-3 shadow-2xs">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <CreditCardIcon className="h-4 w-4 text-rose-500" />
                  <span>6. Payments & Collections Ledger</span>
                </div>
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  Record customer payments via bank transfer, cheque, or cash. In automatic FIFO mode, receipts are allocated against the customer&apos;s oldest outstanding invoices until zeroed out.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Glossary */}
        {activeTab === "glossary" && (
          <div className="mt-4 space-y-3 text-xs">
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">BOM (Bill of Materials)</span>
                <Badge variant="secondary">Manufacturing</Badge>
              </div>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                The standard formulation recipe that specifies exact quantities of raw ingredients (flour, oil, spices) and packaging materials (pouches, cartons) required to produce a standard batch of finished goods.
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">ATP (Available to Promise)</span>
                <Badge variant="secondary">Inventory & Sales</Badge>
              </div>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                The quantity of finished goods physically on hand minus active reservations from already-approved orders. Sales orders exceeding ATP trigger shortage alerts.
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Yield Variance</span>
                <Badge variant="secondary">Costing</Badge>
              </div>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                Percentage difference between standard recipe expected output (e.g. 200 packets) and actual good output (e.g. 188 packets). Variances over 5% indicate process inefficiencies or wastage.
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">FIFO (First-In, First-Out)</span>
                <Badge variant="secondary">Finance & Allocation</Badge>
              </div>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                An automatic payment allocation rule ensuring customer receipts are applied against the oldest unpaid invoices first, preventing lingering aging receivables.
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">WAC (Weighted Average Cost)</span>
                <Badge variant="secondary">Valuation</Badge>
              </div>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                Perpetual average unit cost method: updated continuously on every purchase receipt as (Existing Value + Inbound Receipt Value) ÷ (Existing Units + Inbound Units).
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Offline Mode */}
        {activeTab === "offline" && (
          <div className="mt-4 space-y-3 text-xs leading-relaxed">
            <div className="rounded-lg bg-muted/40 p-3 border">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2Icon className="h-4 w-4 text-emerald-500" />
                <span>Field-Ready Offline Operation</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Salesmen operating in rural mills and transit areas can create customer orders without an active internet connection. Orders are stored safely in an encrypted client-side IndexedDB outbox.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <span className="font-semibold text-foreground">Automatic Synchronization</span>
                <p className="mt-1 text-muted-foreground">
                  As soon as connectivity is restored, the outbox processor submits queued orders with unique idempotency keys to guarantee exactly-once server processing.
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <span className="font-semibold text-foreground">Conflict Safeguards</span>
                <p className="mt-1 text-muted-foreground">
                  Offline orders are submitted in draft status and never falsely presented as stock-reserved until validated and approved by the mill server.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end border-t pt-4">
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="px-4"
          >
            Close Guide
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
