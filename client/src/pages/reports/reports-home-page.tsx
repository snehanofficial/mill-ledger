import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

export function ReportsHomePage() {
  const { t } = useTranslation("reports");

  const reportGroups = [
    {
      title: t("groups.salesGst"),
      items: [
        {
          title: t("cards.salesRegisterTitle"),
          description: t("cards.salesRegisterDesc"),
          href: "/reports/sales",
          icon: BarChart2Icon,
        },
        {
          title: t("cards.gstSummaryTitle"),
          description: t("cards.gstSummaryDesc"),
          href: "/reports/gst",
          icon: FileTextIcon,
        },
        {
          title: t("cards.invoiceRecordsTitle"),
          description: t("cards.invoiceRecordsDesc"),
          href: "/invoices",
          icon: ReceiptIcon,
        },
      ],
    },
    {
      title: t("groups.inventoryProd"),
      items: [
        {
          title: t("cards.stockValTitle"),
          description: t("cards.stockValDesc"),
          href: "/reports/stock",
          icon: BoxIcon,
        },
        {
          title: t("cards.prodCostingTitle"),
          description: t("cards.prodCostingDesc"),
          href: "/reports/production",
          icon: FactoryIcon,
        },
      ],
    },
    {
      title: t("groups.collectionsAudit"),
      items: [
        {
          title: t("cards.receivablesTitle"),
          description: t("cards.receivablesDesc"),
          href: "/reports/receivables",
          icon: WalletIcon,
        },
        {
          title: t("cards.auditTrailTitle"),
          description: t("cards.auditTrailDesc"),
          href: "/reports/audit",
          icon: ShieldCheckIcon,
        },
        {
          title: t("cards.exportsTitle"),
          description: t("cards.exportsDesc"),
          href: "/exports",
          icon: SendIcon,
        },
      ],
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      <PageHeader title={t("homeTitle")} description={t("homeDesc")} />

      <div className="space-y-6">
        {reportGroups.map((group) => (
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
