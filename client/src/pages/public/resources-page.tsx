import { Link } from "react-router-dom";
import { ArrowRightIcon } from "lucide-react";
import { PublicLayout } from "@/layouts/public-layout";

const RESOURCE_GUIDES = [
  {
    slug: "/resources/indian-gst-invoicing-for-food-mills",
    title: "Indian GST Invoicing & Credit Notes for Food Mills",
    audience: "Factory Admins, Accountants, Mill Owners",
    summary:
      "How intra-state CGST/SGST vs. inter-state IGST, HSN tax snapshots, financial-year invoice numbering, and credit-note corrections work in MillLedger.",
  },
  {
    slug: "/resources/moving-weighted-average-stock-ledger",
    title: "Moving Weighted Average Stock Ledger & ATP Reservations",
    audience: "Mill Owners, Inventory Managers, Production Supervisors",
    summary:
      "Why overwriting stock balances causes audit gaps, how moving weighted average recalculates on purchase receipts, and how Available-to-Promise (ATP) prevents double-selling.",
  },
  {
    slug: "/resources/offline-salesman-order-capture",
    title: "Offline Salesman Order Capture & Idempotent Sync",
    audience: "Field Sales Teams, Distribution Managers",
    summary:
      "How IndexedDB outbox queuing and server idempotency keys handle weak connectivity without duplicating orders or faking stock reservations.",
  },
];

export function ResourcesPage() {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-card py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Mill Operations &amp; Accounting Guides
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              Technical guides explaining how MillLedger models inventory
              valuation, Indian GST billing, and offline field sales
              synchronization.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          {RESOURCE_GUIDES.map((guide) => (
            <article
              key={guide.slug}
              className="rounded-xl border border-border bg-card p-6 sm:p-8 space-y-3"
            >
              <p className="text-xs font-medium text-primary">
                For: {guide.audience}
              </p>
              <h2 className="text-xl font-bold text-foreground">
                <Link
                  to={guide.slug}
                  className="hover:text-primary hover:underline underline-offset-4 transition-colors"
                >
                  {guide.title}
                </Link>
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {guide.summary}
              </p>
              <div className="pt-1">
                <Link
                  to={guide.slug}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline underline-offset-4"
                >
                  <span>Read guide</span>
                  <ArrowRightIcon className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
