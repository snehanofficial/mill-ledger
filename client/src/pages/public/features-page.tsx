import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { PublicLayout } from "./public-layout";

const VERIFIED_MODULES = [
  {
    name: "Inventory & Multi-UOM Stock Ledger",
    route: "/stock, /purchases",
    capabilities: [
      "Separate tracking for raw materials, packaging, and finished goods.",
      "Direct stock overwrites are blocked; every balance change is a transactional movement linked to a purchase receipt, production run, adjustment, dispatch, or return.",
      "Moving weighted average valuation recalculates atomically on each purchase receipt.",
      "Supports kg, g, litre, ml, pieces, packets, and item-specific carton UOM conversions.",
      "Displays On-Hand, Reserved, and Available-to-Promise (ATP) quantities with full item ledger drill-down.",
    ],
  },
  {
    name: "Versioned BOM & Production Costing",
    route: "/production/today, /production/recipes",
    capabilities: [
      "Versioned Bill of Materials (BOM) recipes preserve historical runs when recipes change.",
      "Records planned vs. actual ingredient consumption, good packet output, damaged packets, labour, gas/power, and other direct costs.",
      "Automatically flags yield variance and ingredient consumption variance against expected recipe quantities.",
      "Raises non-blocking warnings when carton packaging capacity differs from good packets produced.",
      "Supports draft saving, atomic posting, and safe reversal of mistaken runs.",
    ],
  },
  {
    name: "Field Sales Orders & Offline Sync",
    route: "/orders, /orders/new",
    capabilities: [
      "Mobile-first order entry designed for 320px+ screens with customer and price-list lookup.",
      "Queues orders locally in Dexie IndexedDB when connectivity drops.",
      "Explicitly separates local, syncing, synced, and stock-shortage conflict states so offline orders are never misrepresented as stock-reserved.",
      "Replays queued orders with server-enforced idempotency keys to prevent duplicates.",
      "Salesmen can edit their own draft orders; other salesmen's drafts and customers are blocked by ABAC.",
    ],
  },
  {
    name: "Order Approval, GST Invoicing & Dispatch",
    route: "/orders, /invoices, /dispatch",
    capabilities: [
      "Admin review queue with ATP shortage checks and line-level quantity/price overrides requiring an audit reason.",
      "Atomic stock reservation on approval prevents double-selling across concurrent orders.",
      "Financial-year GST tax invoices with HSN snapshots and intra-state (CGST + SGST) or inter-state (IGST) calculation.",
      "Downloadable PDF tax invoices plus copy-link and WhatsApp sharing actions.",
      "Supports partial dispatches, physical stock deduction at dispatch, sales returns, and credit/debit notes without mutating posted invoices.",
    ],
  },
  {
    name: "Payments, Receivables & Reporting",
    route: "/payments, /receivables, /reports/*",
    capabilities: [
      "Records customer payments with FIFO or manual invoice allocation and unallocated advances.",
      "Supports payment bounce and allocation reversals with exact 2-decimal paise arithmetic.",
      "9 report views: Sales Register, Customer-wise Sales, Product-wise Sales, GST Outward Summary, Stock Valuation, Stock Ledger, Production & Variances, Receivables & Ageing, and Audit Logs.",
      "Exports reports to CSV, XLSX, and PDF respecting the active user's role scope.",
      "Includes a 360-degree entity lifecycle timeline across orders, invoices, payments, customers, products, and recipes.",
    ],
  },
];

export function FeaturesPage() {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-card py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Verified ERP Capabilities for Food Manufacturing Mills
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              MillLedger is built as a modular monolith using React 19, Express
              5, Better Auth, Prisma 7, and PostgreSQL. Every module listed
              below is implemented and verified in the current application.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          {VERIFIED_MODULES.map((mod) => (
            <article
              key={mod.name}
              className="rounded-xl border border-border bg-card p-6 sm:p-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-4 mb-4">
                <h2 className="text-xl font-bold text-foreground">
                  {mod.name}
                </h2>
                <span className="font-mono text-xs text-muted-foreground">
                  App Workspace: {mod.route}
                </span>
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground list-disc pl-5">
                {mod.capabilities.map((cap) => (
                  <li key={cap} className="leading-relaxed">
                    {cap}
                  </li>
                ))}
              </ul>
            </article>
          ))}

          {/* Honest Scope Boundaries */}
          <div className="rounded-xl border border-border bg-muted/30 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-foreground mb-3">
              Current Scope Boundaries (What MillLedger Does Not Claim)
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              To support accurate evaluation, MillLedger explicitly documents
              features that are outside the current release:
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm text-muted-foreground list-disc pl-5">
              <li>
                No live government GST portal (IRN / GSTR-1 API) push
                integration.
              </li>
              <li>
                No automated Tally XML export or full general-ledger chart of
                accounts.
              </li>
              <li>
                No batch/expiry FEFO lot-tracking or automated reorder-level
                alerts yet.
              </li>
              <li>
                No electronic weighbridge hardware serial-port integration.
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/demo"
              className={buttonVariants({
                variant: "primary",
                className: "min-h-[44px] px-6",
              })}
            >
              Request a Product Demo
            </Link>
            <Link
              to="/workflows"
              className={buttonVariants({
                variant: "outline",
                className: "min-h-[44px] px-6",
              })}
            >
              View Order-to-Audit Workflows
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
