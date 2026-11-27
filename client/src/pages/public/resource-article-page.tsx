import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { PublicLayout } from "./public-layout";

export type ResourceArticleId =
  "gst-invoicing" | "stock-ledger" | "offline-orders";

interface ArticleSection {
  heading: string;
  body: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
}

interface ArticleData {
  title: string;
  lead: string;
  sections: ArticleSection[];
}

const ARTICLES: Record<ResourceArticleId, ArticleData> = {
  "gst-invoicing": {
    title: "Indian GST Invoicing & Credit Notes for Food Mills",
    lead: "MillLedger calculates intra-state CGST/SGST and inter-state IGST from the mill's state and the customer's place of supply, snapshots HSN tax rates at posting, and uses credit notes instead of editing posted invoices.",
    sections: [
      {
        heading: "How Intra-State vs. Inter-State GST Is Determined",
        body: [
          "When an administrator generates a tax invoice from an approved sales order, the backend compares the organization's state code with the customer's place of supply.",
          "For intra-state sales (for example, a Tamil Nadu mill supplying a Tamil Nadu retailer), tax splits evenly into CGST and SGST. For inter-state sales (for example, supplying a Karnataka distributor), the full tax rate applies as IGST.",
        ],
        table: {
          headers: [
            "Scenario",
            "Taxable Value",
            "CGST",
            "SGST",
            "IGST",
            "Invoice Total",
          ],
          rows: [
            [
              "Intra-State (5% GST)",
              "₹7,500.00",
              "₹187.50 (2.5%)",
              "₹187.50 (2.5%)",
              "₹0.00",
              "₹7,875.00",
            ],
            [
              "Inter-State (5% GST)",
              "₹100.00",
              "₹0.00",
              "₹0.00",
              "₹5.00 (5.0%)",
              "₹105.00",
            ],
          ],
        },
      },
      {
        heading: "Why Posted Invoices Are Immutable",
        body: [
          "Editing a posted invoice in place breaks tax register reconciliation and hides audit history. In MillLedger, posted invoices are immutable.",
          "If a customer returns damaged goods or receives a post-invoice rate adjustment, the administrator issues a formal Credit Note. The credit note reduces the invoice's outstanding balance using exact 2-decimal paise arithmetic while preserving the original invoice.",
        ],
      },
      {
        heading: "Exporting GST Registers",
        body: [
          "Accountants and owners can filter the Sales Tax Register and GST Outward Summary by date range and customer, then export matching totals to CSV, XLSX, or PDF.",
        ],
      },
    ],
  },
  "stock-ledger": {
    title: "Moving Weighted Average Stock Ledger & ATP Reservations",
    lead: "MillLedger prohibits direct stock balance overwrites. Every inventory change is recorded as a traceable stock movement, valuation updates atomically via moving weighted average, and order approval reserves Available-to-Promise (ATP) stock.",
    sections: [
      {
        heading: "How Moving Weighted Average Valuation Works",
        body: [
          "When a purchase receipt is posted, MillLedger combines the existing on-hand quantity and valuation with the new receipt quantity and total cost inside a database transaction.",
          "For example, if 100 kg of flour is on hand at ₹42.00/kg (₹4,200.00) and a mill receives 60 kg at ₹45.00/kg (₹2,700.00), the new balance is 160 kg at ₹6,900.00 total, giving a weighted average cost of ₹43.125/kg.",
        ],
        table: {
          headers: ["Step", "Quantity", "Unit Cost", "Total Value"],
          rows: [
            ["Opening Flour Balance", "100 kg", "₹42.00 / kg", "₹4,200.00"],
            ["Purchase Receipt", "+60 kg", "₹45.00 / kg", "+₹2,700.00"],
            ["Updated Weighted Average", "160 kg", "₹43.125 / kg", "₹6,900.00"],
          ],
        },
      },
      {
        heading: "On-Hand vs. Reserved vs. Available-to-Promise (ATP)",
        body: [
          "Physical On-Hand stock shows what is currently in the warehouse. Reserved stock tracks quantities committed to approved sales orders that have not yet been dispatched.",
          "Available-to-Promise (ATP) equals On-Hand minus Reserved. When an order exceeds ATP (for example, 120 packets requested when 88 are available), the server blocks approval with a shortage error instead of letting two buyers claim the same stock.",
        ],
      },
    ],
  },
  "offline-orders": {
    title: "Offline Salesman Order Capture & Idempotent Sync",
    lead: "Field salesmen often visit retailers in low-connectivity areas. MillLedger stores queued orders in Dexie IndexedDB, displays explicit Local, Syncing, Synced, and Conflict states, and replays submissions using idempotency keys.",
    sections: [
      {
        heading: "Honest Offline States",
        body: [
          "A queued offline order has not reached the server yet, so it has not reserved warehouse stock. MillLedger never presents a locally queued order as server-submitted or stock-reserved.",
        ],
        table: {
          headers: ["Outbox State", "Meaning", "Stock Reserved?"],
          rows: [
            [
              "Local",
              "Saved in device IndexedDB waiting for connectivity.",
              "No",
            ],
            [
              "Syncing",
              "Submitting to Express API with unique idempotency key.",
              "Pending",
            ],
            [
              "Synced",
              "Committed on PostgreSQL and assigned a server order number.",
              "On admin approval",
            ],
            [
              "Conflict",
              "Rejected by server (for example, insufficient stock); user can review or discard.",
              "No",
            ],
          ],
        },
      },
      {
        heading: "Preventing Duplicate Orders on Weak Networks",
        body: [
          "Mobile networks frequently drop mid-response, causing clients to retry the same POST request. MillLedger attaches a deterministic idempotency key to each queued order so replaying the request returns the original committed order rather than creating duplicates.",
        ],
      },
    ],
  },
};

export function ResourceArticlePage({
  articleId,
}: {
  articleId: ResourceArticleId;
}) {
  const article = ARTICLES[articleId];

  return (
    <PublicLayout>
      <article className="py-12 sm:py-16 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-10">
          <header className="space-y-4 border-b border-border pb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {article.title}
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              {article.lead}
            </p>
          </header>

          {article.sections.map((sec) => (
            <section key={sec.heading} className="space-y-4">
              <h2 className="text-xl font-bold text-foreground">
                {sec.heading}
              </h2>
              {sec.body.map((p) => (
                <p
                  key={p}
                  className="text-sm sm:text-base text-muted-foreground leading-relaxed"
                >
                  {p}
                </p>
              ))}
              {sec.table && (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        {sec.table.headers.map((h) => (
                          <th key={h} className="px-4 py-3 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sec.table.rows.map((row, idx) => (
                        <tr key={idx}>
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-4 py-3 text-foreground whitespace-nowrap"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}

          <footer className="border-t border-border pt-8 flex flex-wrap gap-3">
            <Link
              to="/demo"
              className={buttonVariants({
                variant: "primary",
                className: "min-h-[44px] px-6",
              })}
            >
              See This Workflow in a Live Demo
            </Link>
            <Link
              to="/resources"
              className={buttonVariants({
                variant: "outline",
                className: "min-h-[44px] px-6",
              })}
            >
              Back to All Guides
            </Link>
          </footer>
        </div>
      </article>
    </PublicLayout>
  );
}
