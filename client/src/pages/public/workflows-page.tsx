import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { PublicLayout } from "@/layouts/public-layout";

const WORKFLOW_STEPS = [
  {
    step: "1. Raw Material & Packaging Purchase Receipt",
    actor: "Admin or Production Supervisor",
    rule: "Atomic Weighted Average Costing",
    summary:
      "When raw flour, oil, spices, or packaging pouches arrive from a supplier, posting a purchase receipt creates traceable stock movements and recalculates the item's moving weighted average unit cost inside a database transaction. Mistaken receipts can be reversed or adjusted via supplier debit notes without deleting history.",
  },
  {
    step: "2. BOM Production Run & Variance Tracking",
    actor: "Production Supervisor",
    rule: "Versioned Recipes & Yield Alerts",
    summary:
      "Operators create a production run from a versioned Bill of Materials (BOM), enter actual ingredient consumption, good packets produced, damaged packets, and direct labour/utility costs. Posting deducts raw materials and packaging, adds finished goods stock, calculates cost per good packet, and flags yield or ingredient variances.",
  },
  {
    step: "3. Mobile Field Salesman Order Entry (Online or Offline)",
    actor: "Field Salesman",
    rule: "ABAC Scoping & Idempotent Sync",
    summary:
      "Salesmen only see customers assigned to them and effective price-list rates. When mobile data drops, orders save to the local IndexedDB outbox marked as Local. Upon reconnection, each order replays with an idempotency key; if stock became insufficient in the meantime, the outbox flags a clear conflict for resolution.",
  },
  {
    step: "4. Admin Order Review & ATP Stock Reservation",
    actor: "Factory Admin",
    rule: "Strict Available-to-Promise (ATP)",
    summary:
      "Approving a submitted order checks Available-to-Promise stock (On-Hand minus Reserved) and reserves the approved quantity transactionally. Admins can adjust line quantities or prices with a mandatory override reason, or reject orders with a documented reason when stock is short.",
  },
  {
    step: "5. GST Tax Invoicing, Dispatch & Sales Returns",
    actor: "Factory Admin",
    rule: "Immutable Posted Documents",
    summary:
      "Invoicing snapshots HSN codes and computes CGST/SGST (intra-state) or IGST (inter-state) with financial-year sequential numbering and PDF generation. Dispatching deducts physical stock and releases the reservation, supporting partial dispatches and sales returns. Posted invoice corrections use credit notes.",
  },
  {
    step: "6. Payment Collection, Bounce Handling & Audit Reports",
    actor: "Admin (Write) / Accountant & Owner (Read)",
    rule: "FIFO Allocation & 360° Timeline",
    summary:
      "Customer receipts allocate automatically via FIFO or manually across open invoices, leaving unallocated advances when overpaid. Bounced cheques reverse allocations and restore invoice balances. All 9 operational and GST reports export cleanly to CSV, XLSX, and PDF.",
  },
];

export function WorkflowsPage() {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-card py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              How MillLedger Runs the Order-to-Audit Workflow
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              In food manufacturing, errors happen when shop-floor production,
              field sales orders, and GST billing live in separate tools.
              MillLedger links every step in one transactional ledger.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          {WORKFLOW_STEPS.map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground">
                  {item.step}
                </h2>
                <span className="rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-xs text-foreground">
                  {item.rule}
                </span>
              </div>
              <p className="text-xs font-medium text-primary">
                Primary Role: {item.actor}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.summary}
              </p>
            </div>
          ))}

          <div className="pt-4 flex flex-wrap gap-3">
            <Link
              to="/demo"
              className={buttonVariants({
                variant: "primary",
                className: "min-h-[44px] px-6",
              })}
            >
              Walk Through This Workflow in a Demo
            </Link>
            <Link
              to="/resources"
              className={buttonVariants({
                variant: "outline",
                className: "min-h-[44px] px-6",
              })}
            >
              Read Technical Guides
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
