import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { PublicLayout } from "./public-layout";

const COMPARISON_ROWS = [
  {
    area: "Stock Balance Tracking",
    spreadsheets:
      "Manual cell edits overwrite previous balances. Hard to tell which purchase or dispatch changed the count.",
    millledger:
      "Direct stock overwrites are disallowed. Every change is an immutable movement linked to a purchase receipt, production run, adjustment, dispatch, or return.",
  },
  {
    area: "Double-Selling Prevention",
    spreadsheets:
      "Salesmen quote from yesterday's sheet; two orders can claim the same finished packets.",
    millledger:
      "Tracks On-Hand, Reserved, and Available-to-Promise (ATP) stock. Approving an order reserves stock transactionally and rejects shortages.",
  },
  {
    area: "BOM & Yield Variance",
    spreadsheets:
      "Formula copy-paste errors hide oil overuse, flour shrinkage, or damaged packets.",
    millledger:
      "Versioned BOM recipes compare planned vs. actual consumption, calculate cost per good packet, and flag yield and ingredient variances automatically.",
  },
  {
    area: "Field Salesman Ordering",
    spreadsheets:
      "WhatsApp messages or phone calls re-typed at the office, creating transcription errors and delays.",
    millledger:
      "Mobile-first order entry with offline IndexedDB queuing, explicit Local/Syncing/Synced/Conflict states, and idempotent replay.",
  },
  {
    area: "GST Invoicing & Corrections",
    spreadsheets:
      "Manual HSN lookups and CGST/SGST/IGST splits; old invoices get edited directly without a trail.",
    millledger:
      "Automated CGST/SGST or IGST tax calculation with HSN snapshots, PDF generation, and credit/debit notes instead of editing posted documents.",
  },
  {
    area: "Audit Readiness",
    spreadsheets:
      "Accountants spend days reconciling stock sheets, invoices, and bank receipts.",
    millledger:
      "Read-only Accountant role with 9 operational and GST reports, CSV/XLSX/PDF exports, and a 360-degree entity lifecycle timeline.",
  },
];

export function SpreadsheetAlternativePage() {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-card py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Spreadsheet Alternative for Small Food Manufacturing Mills
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              Spreadsheets work when a unit has one operator and a single product. Once field salesmen, multi-UOM raw materials, BOM yields, and GST invoicing scale up, manual sheets break down. Here is how MillLedger compares on daily mill operations.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Operational Area</th>
                  <th className="px-5 py-3.5 font-semibold">Manual Spreadsheets</th>
                  <th className="px-5 py-3.5 font-semibold">MillLedger ERP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs sm:text-sm">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.area}>
                    <td className="px-5 py-4 font-semibold text-foreground align-top whitespace-nowrap">
                      {row.area}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground align-top leading-relaxed">
                      {row.spreadsheets}
                    </td>
                    <td className="px-5 py-4 text-foreground align-top leading-relaxed">
                      {row.millledger}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/demo"
              className={buttonVariants({ variant: "primary", className: "min-h-[44px] px-6" })}
            >
              Request a Migration Walkthrough
            </Link>
            <Link
              to="/features"
              className={buttonVariants({ variant: "outline", className: "min-h-[44px] px-6" })}
            >
              Inspect All ERP Features
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
