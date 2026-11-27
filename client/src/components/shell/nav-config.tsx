/**
 * Role-aware shell navigation configuration for MillLedger.
 * Organised around each role's actual work queues and journeys
 * per docs/02-experience/MILLLEDGER_USER_JOURNEY_UX_BLUEPRINT.md.
 */

import {
  ArchiveIcon,
  BarChart2Icon,
  BookOpenIcon,
  BoxIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  HomeIcon,
  PackageIcon,
  PlusCircleIcon,
  ReceiptIcon,
  SendIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { Role } from "@mill-ledger/shared";

export type UserRole = Role;

export interface NavLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  items?: NavLink[];
  roles: UserRole[];
  badge?: React.ReactNode;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

/**
 * Returns the navigation sections visible to `role`.
 * Each role sees only the destinations relevant to its operational scope.
 */
export function getNavSections(role: UserRole): NavSection[] {
  if (role === "SALESMAN") {
    return [
      {
        label: "Field Sales",
        items: [
          {
            label: "My work",
            href: "/orders",
            icon: <HomeIcon className="size-4" aria-hidden />,
            roles: ["SALESMAN"],
          },
          {
            label: "New order",
            href: "/orders/new",
            icon: <PlusCircleIcon className="size-4" aria-hidden />,
            roles: ["SALESMAN"],
          },
          {
            label: "My customers",
            href: "/customers",
            icon: <UsersIcon className="size-4" aria-hidden />,
            roles: ["SALESMAN"],
          },
        ],
      },
      {
        label: "Reference",
        items: [
          {
            label: "Product catalogue",
            href: "/products",
            icon: <PackageIcon className="size-4" aria-hidden />,
            roles: ["SALESMAN"],
          },
          {
            label: "My sales summary",
            href: "/reports/sales",
            icon: <BarChart2Icon className="size-4" aria-hidden />,
            roles: ["SALESMAN"],
          },
        ],
      },
    ];
  }

  if (role === "PRODUCTION") {
    return [
      {
        label: "Production Floor",
        items: [
          {
            label: "Today's runs",
            href: "/production/today",
            icon: <HomeIcon className="size-4" aria-hidden />,
            roles: ["PRODUCTION"],
          },
          {
            label: "New production run",
            href: "/production/new",
            icon: <PlusCircleIcon className="size-4" aria-hidden />,
            roles: ["PRODUCTION"],
          },
          {
            label: "Run history",
            href: "/production/history",
            icon: <ClipboardListIcon className="size-4" aria-hidden />,
            roles: ["PRODUCTION"],
          },
        ],
      },
      {
        label: "Materials & Stock",
        items: [
          {
            label: "Stock availability",
            href: "/stock",
            icon: <BoxIcon className="size-4" aria-hidden />,
            roles: ["PRODUCTION"],
          },
          {
            label: "Receive materials",
            href: "/purchases",
            icon: <PackageIcon className="size-4" aria-hidden />,
            roles: ["PRODUCTION"],
          },
          {
            label: "Suppliers",
            href: "/suppliers",
            icon: <TruckIcon className="size-4" aria-hidden />,
            roles: ["PRODUCTION"],
          },
        ],
      },
      {
        label: "Reference & Reports",
        items: [
          {
            label: "Recipes & BOMs",
            href: "/production/recipes",
            icon: <BookOpenIcon className="size-4" aria-hidden />,
            roles: ["PRODUCTION"],
          },
          {
            label: "Products",
            href: "/products",
            icon: <ArchiveIcon className="size-4" aria-hidden />,
            roles: ["PRODUCTION"],
          },
          {
            label: "Production reports",
            href: "/reports/production",
            icon: <BarChart2Icon className="size-4" aria-hidden />,
            roles: ["PRODUCTION"],
          },
        ],
      },
    ];
  }

  if (role === "ACCOUNTANT") {
    return [
      {
        label: "Reporting & Audit",
        items: [
          {
            label: "Reporting home",
            href: "/reports",
            icon: <HomeIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "Sales register",
            href: "/reports/sales",
            icon: <BarChart2Icon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "GST outward summary",
            href: "/reports/gst",
            icon: <FileTextIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "Stock & valuation",
            href: "/reports/stock",
            icon: <BoxIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "Production & costing",
            href: "/reports/production",
            icon: <ArchiveIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "Receivables ageing",
            href: "/reports/receivables",
            icon: <WalletIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "Audit trail",
            href: "/reports/audit",
            icon: <ShieldCheckIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "Exports",
            href: "/exports",
            icon: <SendIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
        ],
      },
      {
        label: "Source Registers (Read-Only)",
        items: [
          {
            label: "Invoice records",
            href: "/invoices",
            icon: <ReceiptIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "Orders",
            href: "/orders",
            icon: <ClipboardListIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "Payments",
            href: "/payments",
            icon: <CreditCardIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "Customer balances",
            href: "/receivables",
            icon: <WalletIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "Purchase register",
            href: "/purchases",
            icon: <PackageIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
          {
            label: "Stock ledger",
            href: "/stock",
            icon: <BoxIcon className="size-4" aria-hidden />,
            roles: ["ACCOUNTANT"],
          },
        ],
      },
    ];
  }

  // ADMIN and OWNER
  const isAdmin = role === "ADMIN";
  const sections: NavSection[] = [
    {
      items: [
        {
          label: isAdmin ? "Work queue" : "Business overview",
          href: "/dashboard",
          icon: <HomeIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
      ],
    },
    {
      label: "Sales & Fulfilment",
      items: [
        {
          label: isAdmin ? "Order inbox" : "Orders",
          href: "/orders",
          icon: <ClipboardListIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
        {
          label: "Invoices",
          href: "/invoices",
          icon: <ReceiptIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
        {
          label: isAdmin ? "Ready to dispatch" : "Dispatch",
          href: "/dispatch",
          icon: <TruckIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
      ],
    },
    {
      label: "Materials & Stock",
      items: [
        {
          label: "Purchase receipts",
          href: "/purchases",
          icon: <PackageIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
        {
          label: "Stock",
          href: "/stock",
          icon: <BoxIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
        {
          label: "Suppliers",
          href: "/suppliers",
          icon: <TruckIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
      ],
    },
    {
      label: "Production",
      items: [
        {
          label: "Today's runs",
          href: "/production/today",
          icon: <ArchiveIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
        {
          label: "Run history",
          href: "/production/history",
          icon: <ClipboardListIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
        {
          label: "Recipes & BOMs",
          href: "/production/recipes",
          icon: <BookOpenIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
      ],
    },
    {
      label: "Finance",
      items: [
        {
          label: "Payments",
          href: "/payments",
          icon: <CreditCardIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
        {
          label: "Customer balances",
          href: "/receivables",
          icon: <WalletIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
      ],
    },
    {
      label: "Reports & Audit",
      items: [
        {
          label: "Reporting home",
          href: "/reports",
          icon: <BarChart2Icon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
        {
          label: "Reports",
          icon: <FileTextIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
          items: [
            { label: "Sales", href: "/reports/sales" },
            { label: "GST outward", href: "/reports/gst" },
            { label: "Stock", href: "/reports/stock" },
            { label: "Production", href: "/reports/production" },
            { label: "Receivables", href: "/reports/receivables" },
            { label: "Audit trail", href: "/reports/audit" },
          ],
        },
        {
          label: "Exports",
          href: "/exports",
          icon: <SendIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
      ],
    },
    {
      label: "Masters & Settings",
      items: [
        {
          label: "Customers",
          href: "/customers",
          icon: <UsersIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
        {
          label: "Products & prices",
          href: "/products",
          icon: <PackageIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
        {
          label: "Settings",
          href: "/settings",
          icon: <SettingsIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
      ],
    },
  ];

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}

/** Flat list of all nav links for a given role (used for breadcrumb generation). */
export function getAllLinks(role: UserRole): NavLink[] {
  const sections = getNavSections(role);
  const links: NavLink[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.href) links.push({ label: item.label, href: item.href });
      if (item.items) links.push(...item.items);
    }
  }
  return links;
}

/** Returns whether `href` matches `pathname` exactly or as a path-segment prefix. */
export function isActiveHref(href: string, pathname: string): boolean {
  if (href === pathname) return true;
  return href !== "/" && pathname.startsWith(`${href.replace(/\/$/, "")}/`);
}

/**
 * Resolves the single most specific matching nav `href` across all sections
 * so parent routes (e.g. `/orders`, `/reports`) are not highlighted alongside
 * more specific sibling or child routes (e.g. `/orders/new`, `/reports/sales`).
 */
export function getActiveNavHref(
  sections: NavSection[],
  pathname: string,
): string | undefined {
  let bestHref: string | undefined;
  const consider = (href: string | undefined) => {
    if (
      href &&
      isActiveHref(href, pathname) &&
      (!bestHref || href.length > bestHref.length)
    ) {
      bestHref = href;
    }
  };

  for (const section of sections) {
    for (const item of section.items) {
      consider(item.href);
      if (item.items) {
        for (const child of item.items) {
          consider(child.href);
        }
      }
    }
  }
  return bestHref;
}
