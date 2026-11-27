import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import {
  BarChart2Icon,
  BoxIcon,
  FactoryIcon,
  FileTextIcon,
  ReceiptIcon,
  SendIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "lucide-react";

const REPORT_GROUPS = [
  {
    title: "Sales & Statutory GST",
    items: [
      {
        title: "Sales register & analysis",
        description:
          "Posted sales invoices, customer-wise sales, and product-wise sales.",
        href: "/reports/sales",
        icon: BarChart2Icon,
      },
      {
        title: "GST outward summary",
        description:
          "Taxable value, CGST, SGST, and IGST breakdown by rate and place of supply.",
        href: "/reports/gst",
        icon: FileTextIcon,
      },
      {
        title: "Invoice records",
        description: "Immutable posted tax invoices and credit notes.",
        href: "/invoices",
        icon: ReceiptIcon,
      },
    ],
  },
  {
    title: "Inventory & Production",
    items: [
      {
        title: "Stock valuation & ledger",
        description:
          "Closing balances, weighted-average cost, and full movement ledger.",
        href: "/reports/stock",
        icon: BoxIcon,
      },
      {
        title: "Production & costing",
        description:
          "Yield variance, material consumption variance, and cost per good packet.",
        href: "/reports/production",
        icon: FactoryIcon,
      },
    ],
  },
  {
    title: "Collections, Receivables & Audit",
    items: [
      {
        title: "Receivables & ageing",
        description: "Customer-wise net outstanding and ageing buckets.",
        href: "/reports/receivables",
        icon: WalletIcon,
      },
      {
        title: "Audit trail",
        description: "Append-only operational and financial audit events.",
        href: "/reports/audit",
        icon: ShieldCheckIcon,
      },
      {
        title: "Exports",
        description: "Download CSV, XLSX, and PDF report bundles.",
        href: "/exports",
        icon: SendIcon,
      },
    ],
  },
];

export function ReportsHomePage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      <PageHeader
        title="Reporting home"
        description="Reconcile posted sales, GST, inventory valuation, production costing, receivables, and audit logs."
      />

      <div className="space-y-6">
        {REPORT_GROUPS.map((group) => (
          <section key={group.title} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {group.title}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="rounded-md bg-primary/10 p-2 text-primary shrink-0">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-semibold text-foreground">
                        {item.title}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
