/**
 * Shell navigation configuration for MillLedger.
 * Groups navigation items by role-visible section.
 * Icons are purposeful: each maps to a real operational domain.
 *
 * Active links and breadcrumbs are derived from route config (see shell.tsx),
 * not hardcoded here.
 */

import {
  ArchiveIcon,
  BarChart2Icon,
  BoxIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  HomeIcon,
  PackageIcon,
  ReceiptIcon,
  SendIcon,
  SettingsIcon,
  TruckIcon,
  UsersIcon,
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
 * The shell filters by role; the server enforces authorization.
 */
export function getNavSections(role: UserRole): NavSection[] {
  const all: NavSection[] = [
    {
      items: [
        {
          label: "Overview",
          href: "/dashboard",
          icon: <HomeIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
        },
      ],
    },
    {
      label: "Operations",
      items: [
        {
          label: "Orders",
          icon: <ClipboardListIcon className="size-4" aria-hidden />,
          roles: ["SALESMAN", "ADMIN", "OWNER", "ACCOUNTANT"],
          items: [
            {
              label: "All orders",
              href: "/orders",
              icon: <ClipboardListIcon className="size-3.5" aria-hidden />,
            },
            {
              label: "New order",
              href: "/orders/new",
              icon: <FileTextIcon className="size-3.5" aria-hidden />,
            },
          ],
        },
        {
          label: "Invoices",
          icon: <ReceiptIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "ACCOUNTANT", "OWNER"],
          href: "/invoices",
        },
        {
          label: "Dispatch",
          icon: <TruckIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
          href: "/dispatch",
        },
        {
          label: "Payments",
          icon: <CreditCardIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "ACCOUNTANT", "OWNER"],
          href: "/payments",
        },
      ],
    },
    {
      label: "Inventory",
      items: [
        {
          label: "Stock",
          icon: <BoxIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
          href: "/stock",
        },
        {
          label: "Purchases",
          icon: <PackageIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
          href: "/purchases",
        },
        {
          label: "Suppliers",
          icon: <TruckIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
          href: "/suppliers",
        },
        {
          label: "Production",
          icon: <ArchiveIcon className="size-4" aria-hidden />,
          roles: ["PRODUCTION", "ADMIN", "OWNER"],
          items: [
            {
              label: "Today's runs",
              href: "/production/today",
              icon: <ArchiveIcon className="size-3.5" aria-hidden />,
            },
            {
              label: "New run",
              href: "/production/new",
              icon: <FileTextIcon className="size-3.5" aria-hidden />,
            },
            {
              label: "Run history",
              href: "/production/history",
              icon: <ClipboardListIcon className="size-3.5" aria-hidden />,
            },
          ],
        },
      ],
    },
    {
      label: "Customers",
      items: [
        {
          label: "Customers",
          icon: <UsersIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "SALESMAN", "OWNER", "ACCOUNTANT"],
          href: "/customers",
        },
      ],
    },
    {
      label: "Reporting",
      items: [
        {
          label: "Reports",
          icon: <BarChart2Icon className="size-4" aria-hidden />,
          roles: ["ADMIN", "ACCOUNTANT", "OWNER", "SALESMAN", "PRODUCTION"],
          items: [
            { label: "Sales", href: "/reports/sales" },
            { label: "Stock", href: "/reports/stock" },
            { label: "Production", href: "/reports/production" },
            { label: "Receivables", href: "/reports/receivables" },
            { label: "GST", href: "/reports/gst" },
            { label: "Audit log", href: "/reports/audit" },
          ],
        },
        {
          label: "Exports",
          icon: <SendIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "ACCOUNTANT", "OWNER"],
          href: "/exports",
        },
      ],
    },
    {
      label: "Settings",
      items: [
        {
          label: "Settings",
          icon: <SettingsIcon className="size-4" aria-hidden />,
          roles: ["ADMIN", "OWNER"],
          href: "/settings",
        },
      ],
    },
  ];

  return all
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
