import { Link } from "react-router-dom";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PublicLayout } from "@/layouts/public-layout";
import { useLanguage } from "@/lib/i18n";

const ORDER_TO_AUDIT_STAGES = [
  {
    stage: "01",
    title: "Purchase Receipts & Weighted Average Cost",
    detail:
      "Record raw material and packaging receipts against suppliers. Moving weighted average cost recalculates atomically on every receipt, and mistaken receipts are reversed rather than overwritten.",
  },
  {
    stage: "02",
    title: "BOM Production Runs & Variance Flags",
    detail:
      "Execute versioned Bill of Materials recipes with actual ingredient consumption, good output, damaged packets, labour, and utility costs. Yield and ingredient variances are flagged automatically.",
  },
  {
    stage: "03",
    title: "Offline Field Salesman Order Capture",
    detail:
      "Field salesmen select assigned customers and price-list rates on mobile phones. Orders queue in IndexedDB when offline and sync idempotently to prevent duplicate orders.",
  },
  {
    stage: "04",
    title: "Admin Review & Strict ATP Stock Reservation",
    detail:
      "Office admins verify Available-to-Promise (ATP) stock, adjust approved quantities or prices with mandatory audit reasons, and reserve inventory so two salesmen cannot double-sell the same batch.",
  },
  {
    stage: "05",
    title: "GST Tax Invoicing & Physical Dispatch",
    detail:
      "Generate financial-year numbered GST tax invoices with HSN snapshots and intra-state CGST/SGST or inter-state IGST splits. Physical stock deducts on dispatch, with PDF and return support.",
  },
  {
    stage: "06",
    title: "FIFO Payment Allocation & Audit Reports",
    detail:
      "Allocate customer payments FIFO or manually, handle cheque bounces cleanly, and export 9 operational and GST registers to CSV, XLSX, or PDF with an immutable audit timeline.",
  },
];

const WORKSPACE_ROLES = [
  {
    role: "Owner",
    device: "Desktop & Tablet",
    focus:
      "Monitors revenue, receivables, stock valuation, production output, unit margin, and variance alerts with drill-down to source documents.",
  },
  {
    role: "Admin / Accounts",
    device: "Desktop",
    focus:
      "Reviews pending orders, enforces ATP stock reservations, posts GST invoices and dispatches, allocates payments, and manages masters and users.",
  },
  {
    role: "Production Supervisor",
    device: "Factory Tablet (EN / தமிழ்)",
    focus:
      "Records BOM production drafts, actual material usage, damaged packets, and direct run costs with bilingual English and Tamil navigation.",
  },
  {
    role: "Field Salesman",
    device: "Mobile Phone (320px+)",
    focus:
      "Captures customer orders in weak-connectivity areas using an offline IndexedDB outbox with clear local, syncing, synced, and conflict states.",
  },
  {
    role: "Accountant / Auditor",
    device: "Desktop (Read-Only)",
    focus:
      "Reconciles sales registers, GST outward summaries, stock valuations, receivables ageing, and audit logs without write access to operational records.",
  },
];

export function LandingPage() {
  const { language } = useLanguage();

  return (
    <PublicLayout showBreadcrumbs={false}>
      {/* Hero: Direct entity clarity and primary conversion actions */}
      <section className="border-b border-border bg-card py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7 space-y-6">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {language === "ta"
                  ? "சிறிய உணவு ஆலைகளுக்கான ஆர்டர்-டு-ஆடிட் ERP மற்றும் சரக்கு கணக்கு"
                  : "Order-to-Audit ERP and Shop Floor Ledger for Small Food Manufacturing Mills"}
              </h1>

              <p className="max-w-2xl text-base text-muted-foreground leading-relaxed sm:text-lg">
                {language === "ta"
                  ? "கொள்முதல், BOM உற்பத்தி, ஆஃப்லைன் விற்பனையாளர் ஆர்டர்கள், இருப்பு முன்பதிவு, GST பில்லிங் மற்றும் தணிக்கை அறிக்கைகளை ஒரே அமைப்பில் இணைக்கும் மென்பொருள்."
                  : "MillLedger replaces disconnected spreadsheets with a single transactional system covering raw material purchases, BOM production costing, offline field sales orders, stock reservations, Indian GST invoicing, and FIFO payment tracking."}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/demo"
                  className={buttonVariants({
                    variant: "primary",
                    size: "lg",
                    className: "min-h-[44px] gap-2 px-6",
                  })}
                >
                  <span>
                    {language === "ta"
                      ? "நேரடி டெமோ கோருக"
                      : "Request a Live Demo"}
                  </span>
                  <ArrowRightIcon className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/features"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "min-h-[44px] px-6",
                  })}
                >
                  {language === "ta"
                    ? "ERP வசதிகளைப் பார்க்க"
                    : "Explore ERP Features"}
                </Link>
              </div>
            </div>

            {/* Structured factual summary table instead of decorative hero mockup */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-border bg-background p-6">
                <h2 className="text-sm font-semibold text-foreground mb-4">
                  What MillLedger Controls
                </h2>
                <dl className="space-y-3 text-xs sm:text-sm">
                  <div className="flex justify-between gap-4 border-b border-border pb-2.5">
                    <dt className="text-muted-foreground">Inventory Ledger</dt>
                    <dd className="font-medium text-foreground text-right">
                      Movement-based, Moving Weighted Average
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2.5">
                    <dt className="text-muted-foreground">
                      Production Costing
                    </dt>
                    <dd className="font-medium text-foreground text-right">
                      Versioned BOM, Yield &amp; Oil/Material Variance
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2.5">
                    <dt className="text-muted-foreground">Field Sales Sync</dt>
                    <dd className="font-medium text-foreground text-right">
                      Offline IndexedDB Outbox + Idempotent Replay
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2.5">
                    <dt className="text-muted-foreground">Tax &amp; Billing</dt>
                    <dd className="font-medium text-foreground text-right">
                      CGST / SGST / IGST, Credit &amp; Debit Notes
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      Access &amp; Languages
                    </dt>
                    <dd className="font-medium text-foreground text-right">
                      5 RBAC/ABAC Roles, English &amp; Tamil UI
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Six-stage Order-to-Audit flow (mirrors actual domain architecture) */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              One Connected Flow from Raw Material Intake to Audit
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Every quantity, unit cost, tax amount, and stock balance traces
              back to a posted source document in PostgreSQL.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ORDER_TO_AUDIT_STAGES.map((item) => (
              <div
                key={item.stage}
                className="rounded-xl border border-border bg-card p-6 flex flex-col gap-2"
              >
                <span className="font-mono text-xs font-semibold text-primary">
                  Stage {item.stage}
                </span>
                <h3 className="text-base font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              to="/workflows"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-4"
            >
              <span>Inspect the complete order-to-audit workflow</span>
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Role-based workspaces table */}
      <section className="border-y border-border bg-muted/30 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Built for Five Distinct Mill Roles
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              Permissions are enforced on the server through Role-Based and
              Attribute-Based Access Control (RBAC/ABAC), not merely hidden in
              the interface.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Role</th>
                  <th className="px-5 py-3.5 font-semibold">Primary Device</th>
                  <th className="px-5 py-3.5 font-semibold">
                    Operational Scope
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs sm:text-sm">
                {WORKSPACE_ROLES.map((row) => (
                  <tr key={row.role}>
                    <td className="px-5 py-4 font-semibold text-foreground whitespace-nowrap">
                      {row.role}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                      {row.device}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground leading-relaxed">
                      {row.focus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Spreadsheet replacement & verification CTA */}
      <section className="py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 rounded-xl border border-border bg-card p-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8 space-y-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Moving Off Spreadsheets and Manual Stock Registers?
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                See how MillLedger prevents double-selling with ATP
                reservations, preserves immutable posted invoices with credit
                notes, and tracks multi-UOM conversions across kg, g, litres,
                packets, and cartons.
              </p>
              <ul className="grid grid-cols-1 gap-2 pt-2 text-xs sm:grid-cols-2 text-foreground">
                <li className="flex items-center gap-2">
                  <CheckIcon
                    className="size-4 text-primary shrink-0"
                    aria-hidden="true"
                  />
                  <span>No direct stock overwrites</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon
                    className="size-4 text-primary shrink-0"
                    aria-hidden="true"
                  />
                  <span>Exact decimal arithmetic (paise precision)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon
                    className="size-4 text-primary shrink-0"
                    aria-hidden="true"
                  />
                  <span>CSV, XLSX, and PDF register exports</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon
                    className="size-4 text-primary shrink-0"
                    aria-hidden="true"
                  />
                  <span>360-degree entity lifecycle audit timeline</span>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-3">
              <Link
                to="/spreadsheet-alternative"
                className={buttonVariants({
                  variant: "outline",
                  className: "min-h-[44px] w-full",
                })}
              >
                Compare Spreadsheets vs. MillLedger
              </Link>
              <Link
                to="/demo"
                className={buttonVariants({
                  variant: "primary",
                  className: "min-h-[44px] w-full",
                })}
              >
                Schedule a Walkthrough
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
