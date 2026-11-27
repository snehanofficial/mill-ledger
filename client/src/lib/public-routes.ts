export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface PublicRouteMeta {
  path: string;
  title: string;
  description: string;
  ogType: "website" | "article";
  changefreq: "weekly" | "monthly";
  priority: string;
  breadcrumbs: BreadcrumbItem[];
  includeSoftwareSchema?: boolean;
}

export const BRAND_ENTITY = {
  name: "MillLedger",
  legalName: "MillLedger",
  category: "Order-to-Audit ERP and Shop Floor Ledger for Food Manufacturing Mills",
  description:
    "Order-to-audit ERP and shop floor ledger software for small food manufacturing mills in India. Covers atomic stock ledgers, BOM production with yield variance tracking, offline salesman order capture, ATP stock reservations, Indian GST invoicing, FIFO payment allocations, and role-based audit reporting.",
  contactEmail: "hello@mill-ledger.com",
  languages: ["English", "Tamil"],
} as const;

export const PUBLIC_ROUTES: PublicRouteMeta[] = [
  {
    path: "/",
    title: "MillLedger | Order-to-Audit ERP for Small Food Manufacturing Mills",
    description:
      "Replace disconnected spreadsheets with MillLedger: atomic stock ledger, BOM production yield & variance tracking, offline salesman order capture, ATP reservations, Indian GST invoicing, and audit-ready reports.",
    ogType: "website",
    changefreq: "weekly",
    priority: "1.0",
    breadcrumbs: [{ name: "Home", path: "/" }],
    includeSoftwareSchema: true,
  },
  {
    path: "/features",
    title: "ERP Features for Food Mills | MillLedger",
    description:
      "Explore MillLedger modules: moving weighted average stock ledger, versioned BOM production runs, offline Dexie salesman ordering, ATP stock reservations, CGST/SGST/IGST invoicing, FIFO payments, and 9-tab audit reporting.",
    ogType: "website",
    changefreq: "monthly",
    priority: "0.9",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Features", path: "/features" },
    ],
    includeSoftwareSchema: true,
  },
  {
    path: "/workflows",
    title: "Order-to-Audit Mill Workflows | MillLedger",
    description:
      "Step-by-step walkthrough of how MillLedger connects purchase receipts, weighted average costing, BOM production runs, field orders, stock reservations, GST dispatch, and FIFO collections.",
    ogType: "website",
    changefreq: "monthly",
    priority: "0.8",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Workflows", path: "/workflows" },
    ],
  },
  {
    path: "/spreadsheet-alternative",
    title: "Spreadsheet Alternative for Food Manufacturing Mills | MillLedger",
    description:
      "Compare manual spreadsheets and disconnected billing against MillLedger's transactional stock ledger, BOM variance alerts, ATP stock reservation, and immutable GST audit trail.",
    ogType: "website",
    changefreq: "monthly",
    priority: "0.8",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Spreadsheet Alternative", path: "/spreadsheet-alternative" },
    ],
  },
  {
    path: "/resources",
    title: "Mill Operations & Accounting Guides | MillLedger Resources",
    description:
      "Practical technical guides for small food manufacturers in India on GST invoicing, moving weighted average stock ledgers, and offline field sales order sync.",
    ogType: "website",
    changefreq: "weekly",
    priority: "0.8",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Resources", path: "/resources" },
    ],
  },
  {
    path: "/resources/indian-gst-invoicing-for-food-mills",
    title: "Indian GST Invoicing & Credit Notes for Food Mills | MillLedger",
    description:
      "How MillLedger handles intra-state CGST/SGST, inter-state IGST, HSN tax snapshots, financial-year invoice numbering, and credit notes without mutating posted invoices.",
    ogType: "article",
    changefreq: "monthly",
    priority: "0.7",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Resources", path: "/resources" },
      {
        name: "Indian GST Invoicing for Food Mills",
        path: "/resources/indian-gst-invoicing-for-food-mills",
      },
    ],
  },
  {
    path: "/resources/moving-weighted-average-stock-ledger",
    title: "Moving Weighted Average Stock Ledger for Food Mills | MillLedger",
    description:
      "Why food mills need a movement-based stock ledger with moving weighted average valuation and Available-to-Promise (ATP) reservations instead of overwriting stock balances.",
    ogType: "article",
    changefreq: "monthly",
    priority: "0.7",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Resources", path: "/resources" },
      {
        name: "Moving Weighted Average Stock Ledger",
        path: "/resources/moving-weighted-average-stock-ledger",
      },
    ],
  },
  {
    path: "/resources/offline-salesman-order-capture",
    title: "Offline Salesman Order Capture & Idempotent Sync | MillLedger",
    description:
      "How MillLedger uses IndexedDB outbox queuing and server idempotency keys so field salesmen can capture orders in low-connectivity areas without duplicate orders or false stock promises.",
    ogType: "article",
    changefreq: "monthly",
    priority: "0.7",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Resources", path: "/resources" },
      {
        name: "Offline Salesman Order Capture",
        path: "/resources/offline-salesman-order-capture",
      },
    ],
  },
  {
    path: "/security",
    title: "Security, RBAC & Ledger Integrity | MillLedger",
    description:
      "Learn how MillLedger protects mill data with Better Auth HttpOnly session cookies, server-enforced RBAC/ABAC across five roles, immutable posted records, and PostgreSQL ACID transactions.",
    ogType: "website",
    changefreq: "monthly",
    priority: "0.7",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Security", path: "/security" },
    ],
  },
  {
    path: "/about",
    title: "About MillLedger | Food Manufacturing Order-to-Audit ERP",
    description:
      "Verified product overview, technical architecture, supported roles, and operational scope of MillLedger ERP for small food manufacturing mills.",
    ogType: "website",
    changefreq: "monthly",
    priority: "0.7",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "About", path: "/about" },
    ],
  },
  {
    path: "/demo",
    title: "Request a Product Demo | MillLedger ERP",
    description:
      "Schedule a guided walkthrough of MillLedger covering BOM production runs, offline field ordering, GST invoicing, and audit-ready mill reporting.",
    ogType: "website",
    changefreq: "monthly",
    priority: "0.9",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Request Demo", path: "/demo" },
    ],
  },
  {
    path: "/contact",
    title: "Contact MillLedger | Product Inquiries & Support",
    description:
      "Contact the MillLedger team for product demonstrations, ERP evaluation questions, or migration guidance from spreadsheets.",
    ogType: "website",
    changefreq: "monthly",
    priority: "0.8",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Contact", path: "/contact" },
    ],
  },
];

export function getPublicRouteMeta(pathname: string): PublicRouteMeta | undefined {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  return PUBLIC_ROUTES.find((r) => r.path === normalized);
}

export function normalizeBaseUrl(rawUrl?: string): string {
  const fallback = "http://localhost:5173";
  const value = (rawUrl || fallback).trim();
  return value.replace(/\/+$/, "");
}

export function buildCanonicalUrl(baseUrl: string, routePath: string): string {
  const cleanBase = normalizeBaseUrl(baseUrl);
  if (routePath === "/") return `${cleanBase}/`;
  return `${cleanBase}${routePath}`;
}

export function buildStructuredDataGraph(
  meta: PublicRouteMeta,
  baseUrl: string,
): Record<string, unknown> {
  const cleanBase = normalizeBaseUrl(baseUrl);
  const canonicalUrl = buildCanonicalUrl(cleanBase, meta.path);

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": `${cleanBase}/#organization`,
      name: BRAND_ENTITY.name,
      url: `${cleanBase}/`,
      email: BRAND_ENTITY.contactEmail,
      description: BRAND_ENTITY.description,
    },
    {
      "@type": "WebSite",
      "@id": `${cleanBase}/#website`,
      url: `${cleanBase}/`,
      name: BRAND_ENTITY.name,
      publisher: { "@id": `${cleanBase}/#organization` },
      inLanguage: ["en", "ta"],
    },
    {
      "@type": "WebPage",
      "@id": `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: meta.title,
      description: meta.description,
      isPartOf: { "@id": `${cleanBase}/#website` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: meta.breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: buildCanonicalUrl(cleanBase, crumb.path),
      })),
    },
  ];

  if (meta.includeSoftwareSchema) {
    graph.push({
      "@type": "SoftwareApplication",
      name: "MillLedger",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web browser (Progressive Web App)",
      description: BRAND_ENTITY.description,
      featureList: [
        "Moving weighted average inventory ledger",
        "Versioned BOM production runs with yield and consumption variance tracking",
        "Offline mobile salesman order capture via IndexedDB",
        "Available-to-Promise (ATP) stock reservation",
        "Indian GST invoicing (CGST, SGST, IGST) and credit/debit notes",
        "FIFO payment allocation and bounce reversal",
        "Role-based and attribute-based access control (RBAC/ABAC)",
        "CSV, XLSX, and PDF operational and GST reports",
      ],
      availableLanguage: ["English", "Tamil"],
      publisher: { "@id": `${cleanBase}/#organization` },
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
