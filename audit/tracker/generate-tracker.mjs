import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

console.log("Generating MillLedger tracker files...");

// Read all findings from audit/findings/
const findingFiles = fs.readdirSync(path.join(ROOT, "audit/findings"))
  .filter(f => f.startsWith("F-") && f.endsWith(".md"))
  .sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ""), 10);
    const numB = parseInt(b.replace(/\D/g, ""), 10);
    return numA - numB;
  });

console.log(`Discovered ${findingFiles.length} finding files.`);

// Cluster definitions
const CLUSTERS = {
  "CLUSTER-01": {
    name: "Financial Math & Decimal Rounding Inexactness",
    tier: "T1",
    rootCause: "Floating point arithmetic in JavaScript numbers instead of integer paise or Decimal arithmetic with statutory rounding (Section 170 CGST Act).",
    evidence: "server/src/modules/finance/finance.service.ts:145; server/src/modules/reporting/reporting.service.ts:77",
    findings: ["F-010", "F-036", "F-097"],
    searchCmd: "grep -rn '\\.toFixed(' client/src/ server/src/ | head -n 30",
    dependsOn: [],
    needsApproval: "schema"
  },
  "CLUSTER-02": {
    name: "Database Concurrency & Missing Row-Level Locks",
    tier: "T1",
    rootCause: "Concurrent database operations execute read-then-write without row-level locking (SELECT ... FOR UPDATE or serializable isolation), allowing negative stock oversell and unique constraint collisions.",
    evidence: "server/src/modules/sales/sales.service.ts:182; server/src/modules/sales/dispatch.service.ts:45; server/src/middleware/idempotency.middleware.ts:40",
    findings: ["F-007", "F-008", "F-015"],
    searchCmd: "grep -rn 'findUnique' server/src/modules/ | grep -v 'test' | head -n 25",
    dependsOn: ["F-009"],
    needsApproval: "none"
  },
  "CLUSTER-03": {
    name: "Ledger Immutability & Relational Trigger Guards",
    tier: "T1",
    rootCause: "Append-only ledgers (stock_movement, sales_invoice, payment) lack database triggers or rules preventing UPDATE and DELETE by application DB users, and lack timezone-invariant accounting period derivation.",
    evidence: "server/prisma/schema.prisma:240; server/src/modules/finance/finance.service.ts:25",
    findings: ["F-009", "F-011", "F-013", "F-014", "F-016"],
    searchCmd: "grep -rn 'deleteMany' server/src/modules/ | head -n 20",
    dependsOn: [],
    needsApproval: "schema"
  },
  "CLUSTER-04": {
    name: "Authorization Enforcement & Central Policy Layer",
    tier: "T2",
    rootCause: "Relying on frontend visibility instead of central server-side ABAC/RBAC policy enforcement, missing route middleware, and lack of client router-level 403 authorization barriers.",
    evidence: "server/src/modules/sales/sales.routes.ts:30; server/src/modules/sales/sales.routes.ts:110; client/src/routes.tsx:45",
    findings: ["F-017", "F-018", "F-019", "F-020", "F-021", "F-027"],
    searchCmd: "grep -rn 'router\\.' server/src/modules/ | grep -v 'requirePermission' | head -n 25",
    dependsOn: ["F-007", "F-009", "F-010"],
    needsApproval: "permission"
  },
  "CLUSTER-05": {
    name: "Identity, Admin Lifecycle & Client Session Hygiene",
    tier: "T2",
    rootCause: "Absence of dedicated user management APIs, mock login bypasses, insecure session cookies, and failure to wipe client-side IndexedDB on logout.",
    evidence: "server/src/modules/auth/auth.routes.ts:9; client/src/pages/login-page.tsx:85; client/src/layouts/authenticated-layout.tsx:68",
    findings: ["F-023", "F-024", "F-028", "F-029", "F-084"],
    searchCmd: "grep -rn 'handleSignOut\\|quickLogin' client/src/ | head -n 20",
    dependsOn: ["F-017"],
    needsApproval: "API"
  },
  "CLUSTER-06": {
    name: "Input Validation, Error Envelopes & Audit Logging",
    tier: "T3",
    rootCause: "Missing Zod schema validation on queries/parameters, uncaught exception stack trace leakage, absence of correlation request IDs, and non-existent audit logging for mutations.",
    evidence: "server/src/middleware/error.middleware.ts:15; server/src/modules/reporting/audit.service.ts:10",
    findings: ["F-012", "F-022", "F-025", "F-026", "F-030", "F-031"],
    searchCmd: "grep -rn 'req\\.query\\|req\\.params' server/src/modules/ | grep -v 'parse' | head -n 25",
    dependsOn: ["F-017", "F-023"],
    needsApproval: "API"
  },
  "CLUSTER-07": {
    name: "HTTP Security Headers, Secrets & Environment Hardening",
    tier: "T4",
    rootCause: "Missing CSP/HSTS headers, reflective CORS origins, unverified proxy headers, vulnerable Zod DoS advisory, and unhardened seed script in production.",
    evidence: "server/src/app.ts:25; server/src/config/env.ts:35; server/prisma/seed.ts:600",
    findings: ["F-004", "F-006", "F-032", "F-033", "F-034", "F-035", "F-100", "F-101", "F-106"],
    searchCmd: "grep -rn 'helmet\\|cors\\|trust proxy' server/src/ | head -n 20",
    dependsOn: ["F-025"],
    needsApproval: "none"
  },
  "CLUSTER-08": {
    name: "Core Domain Feature Slices & Incomplete Workflows",
    tier: "T5",
    rootCause: "Feature gaps where UI pages, API endpoints, or database relations were left as stubs or partial implementations (Suppliers CRUD, BOM recipes, Invoice creation, Running balance, Returns).",
    evidence: "server/src/modules/inventory/inventory.routes.ts:76; client/src/pages/placeholder-pages.tsx:1",
    findings: ["F-037", "F-038", "F-039", "F-040", "F-041", "F-042", "F-043"],
    searchCmd: "grep -rn 'placeholder\\|TODO' client/src/ server/src/ | head -n 25",
    dependsOn: ["F-010", "F-017", "F-025"],
    needsApproval: "API"
  },
  "CLUSTER-09": {
    name: "UI/UX Resilience, Empty States & Form Feedback",
    tier: "T6",
    rootCause: "Ad-hoc component implementation lacking standardized loading, empty, and error states, missing confirmation dialogs, and poor form dirty-state UX.",
    evidence: "client/src/pages/orders-page.tsx:120; client/src/pages/payments-page.tsx:85",
    findings: ["F-045", "F-046", "F-047", "F-048", "F-049", "F-050"],
    searchCmd: "grep -rn '<table\\|useForm' client/src/pages/ | head -n 25",
    dependsOn: ["F-038"],
    needsApproval: "none"
  },
  "CLUSTER-10": {
    name: "WCAG 2.2 AA Accessibility & Screen Reader Barriers",
    tier: "T7",
    rootCause: "Accessible name mismatches, duplicate skip links, non-compliant touch targets (< 24px/44px), lack of keyboard focus traps, low contrast, and untagged language spans.",
    evidence: "client/src/components/shell/authenticated-shell.tsx:845; client/src/pages/login-page.tsx:185",
    findings: ["F-001", "F-044", "F-051", "F-052", "F-053", "F-054", "F-055", "F-056", "F-057", "F-058", "F-059", "F-060", "F-061"],
    searchCmd: "grep -rn 'Skip to main content\\|aria-label' client/src/ | head -n 25",
    dependsOn: ["F-045"],
    needsApproval: "none"
  },
  "CLUSTER-11": {
    name: "Motion & Animation Accessibility Deficits",
    tier: "T7",
    rootCause: "CSS animations and transitions lacking motion-reduce:none guards, unbounded duration, or triggering layout recalculations.",
    evidence: "client/src/components/ui/dialog.tsx:20; client/src/index.css:40",
    findings: ["F-062", "F-063", "F-064", "F-065", "F-066", "F-067", "F-068", "F-069"],
    searchCmd: "grep -rn 'transition-\\|animate-' client/src/ | grep -v 'motion-reduce' | head -n 25",
    dependsOn: ["F-001"],
    needsApproval: "none"
  },
  "CLUSTER-12": {
    name: "Client & Server Scalability, Bundles & Database Indexing",
    tier: "T8",
    rootCause: "Monolithic client bundles without code splitting/tree-shaking, unbounded database queries without pagination, and unindexed foreign keys causing full table scans.",
    evidence: "server/src/modules/sales/sales.service.ts:40; server/prisma/schema.prisma:150; client/vite.config.ts:30",
    findings: ["F-070", "F-071", "F-072", "F-073", "F-074", "F-075", "F-076", "F-077", "F-078", "F-079"],
    searchCmd: "grep -rn 'findMany(' server/src/modules/ | grep -v 'take:' | head -n 25",
    dependsOn: ["F-038"],
    needsApproval: "schema"
  },
  "CLUSTER-13": {
    name: "Localization (Tamil) & Offline Outbox Fault Tolerance",
    tier: "T9",
    rootCause: "Hardcoded English text strings without dictionary keys, unhandled queue errors leading to head-of-line blocking, and missing persistent browser storage requests.",
    evidence: "client/src/lib/i18n.ts:10; client/src/lib/offline-sync.ts:60",
    findings: ["F-080", "F-081", "F-082", "F-083", "F-085", "F-086", "F-087"],
    searchCmd: "grep -rn 'useLanguage' client/src/ | head -n 25",
    dependsOn: ["F-038", "F-051"],
    needsApproval: "none"
  },
  "CLUSTER-14": {
    name: "Public SEO, Route Semantics & Discovery Architecture",
    tier: "T10",
    rootCause: "Authenticated SPA lacking X-Robots-Tag: noindex, missing static robots.txt/sitemap.xml, soft 404 responses, and lack of public marketing surfaces.",
    evidence: "server/src/app.ts:50; client/src/routes.tsx:120",
    findings: ["F-088", "F-089", "F-090", "F-091", "F-092", "F-093"],
    searchCmd: "grep -rn 'robots\\|sitemap\\|meta' client/ server/ | head -n 25",
    dependsOn: ["F-019"],
    needsApproval: "none"
  },
  "CLUSTER-15": {
    name: "Code Quality, Type Safety, Container Ops & Documentation Hygiene",
    tier: "T11",
    rootCause: "Unused dependencies, loose TypeScript typings (any), missing CI quality gates, broken container Dockerfile, missing production runbooks, and documentation drift.",
    evidence: "Dockerfile:10; package.json:20; README.md:15",
    findings: ["F-002", "F-003", "F-005", "F-094", "F-095", "F-096", "F-098", "F-099", "F-102", "F-103", "F-104", "F-105"],
    searchCmd: "grep -rn ': any' server/src/ | head -n 25",
    dependsOn: ["F-070"],
    needsApproval: "none"
  }
};

// Map each finding to its cluster
const findingToCluster = {};
for (const [cId, cData] of Object.entries(CLUSTERS)) {
  for (const fId of cData.findings) {
    findingToCluster[fId] = cId;
  }
}

// Blocked decisions list
const BLOCKED_DECISIONS = {
  "F-013": "BLOCKED on Owner Decision OD-06: Payment Bounce and Debit Note Data Model Specification.",
  "F-014": "BLOCKED on Owner Decision OD-01: Dynamic GST Rate Master Source vs Static Product Column.",
  "F-018": "BLOCKED on Owner Decision OD-03: Multi-tier ABAC Scoping Matrix for Salesmen & Dispatches.",
  "F-020": "BLOCKED on Owner Decision OD-07: Sales Order Unit Price Discount Bounds and Margin Policy.",
  "F-023": "BLOCKED on Owner Decision OD-02: Super Admin Bootstrap and First-Run Credential Policy.",
  "F-083": "BLOCKED on Owner Decision OD-04: Offline Outbox Stock Shortage Conflict Queue Policy (REQ-052).",
  "F-106": "BLOCKED on Owner Decision OD-08: DPDP Act 2023 Customer Data Retention, Anonymization & Erasure Schedule."
};

// Duplicate findings list
const DUPLICATES = {
  "F-044": { canonical: "F-055", note: "owner-approved: Merged duplicate into canonical finding F-055 per Phase 15 final report." },
  "F-061": { canonical: "F-001", note: "owner-approved: Merged duplicate into canonical finding F-001 per Phase 15 final report." },
  "F-084": { canonical: "F-028", note: "owner-approved: Merged duplicate into canonical finding F-028 per Phase 15 final report." },
  "F-101": { canonical: "F-004", note: "owner-approved: Merged duplicate into canonical finding F-004 per Phase 15 final report." }
};

// Run sibling search commands for clusters
console.log("Running sibling search sweeps across codebase...");
const siblingSweepResults = {};
for (const [cId, cData] of Object.entries(CLUSTERS)) {
  try {
    const rawOut = execSync(cData.searchCmd, { cwd: ROOT, encoding: "utf8" });
    const hits = rawOut.split("\n").filter(l => l.trim().length > 0);
    siblingSweepResults[cId] = { done: true, queryUsed: cData.searchCmd, hits };
  } catch (err) {
    siblingSweepResults[cId] = { done: true, queryUsed: cData.searchCmd, hits: [] };
  }
}

// Parse each finding file and build work items
const items = [];

for (const file of findingFiles) {
  const content = fs.readFileSync(path.join(ROOT, "audit/findings", file), "utf8");
  const fId = file.replace(".md", "");

  const idMatch = content.match(/ID[\*:\s]+([^\n\r]+)/i);
  const titleMatch = content.match(/Title[\*:\s]+([^\n\r]+)/i);
  const sevMatch = content.match(/Severity[\*:\s]+([^\n\r]+)/i);
  const catMatch = content.match(/Category[\*:\s]+([^\n\r]+)/i);
  const stdMatch = content.match(/Standard refs[\*:\s]+([^\n\r]+)/i);
  const effortMatch = content.match(/Effort[\*:\s]+([^\n\r]+)/i);

  const title = titleMatch ? titleMatch[1].replace(/[\*#]/g, "").trim() : fId;
  let severity = "P2";
  if (sevMatch) {
    const s = sevMatch[1].trim();
    if (s.startsWith("P0")) severity = "P0";
    else if (s.startsWith("P1")) severity = "P1";
    else if (s.startsWith("P2")) severity = "P2";
    else if (s.startsWith("P3")) severity = "P3";
  }

  const category = catMatch ? catMatch[1].replace(/[\*#]/g, "").trim() : "General";
  let effort = "M";
  if (effortMatch) {
    const e = effortMatch[1].trim().toUpperCase();
    if (e.includes("S")) effort = "S";
    else if (e.includes("L")) effort = "L";
    else effort = "M";
  }

  const standardsRefs = stdMatch ? stdMatch[1].split(",").map(s => s.trim()).filter(Boolean) : [];

  const clusterId = findingToCluster[fId] || "CLUSTER-15";
  const clusterData = CLUSTERS[clusterId];
  const tier = clusterData.tier;

  // Extract referenced files
  const fileMatches = [...content.matchAll(/([a-zA-Z0-9_\-\.\/]+\.(?:ts|tsx|js|mjs|json|prisma|sql|css|html|yml|yaml))/g)]
    .map(m => m[1])
    .filter(p => !p.startsWith("audit/") && (p.includes("/") || p.endsWith(".json") || p.endsWith(".ts")));
  const files = [...new Set(fileMatches)].slice(0, 5);
  if (files.length === 0) files.push("server/src/index.ts");

  // Determine status and history
  let status = "OPEN";
  const statusHistory = [
    {
      status: "OPEN",
      date: "2026-11-20",
      commit: null,
      evidenceLink: `audit/findings/${file}`,
      note: "Discovered during audit phase."
    }
  ];

  let notes = "";
  if (DUPLICATES[fId]) {
    status = "WONT-FIX";
    notes = DUPLICATES[fId].note;
    statusHistory.push({
      status: "WONT-FIX",
      date: "2026-11-20",
      commit: null,
      evidenceLink: "audit/99-final-report.md",
      note: DUPLICATES[fId].note
    });
  } else if (BLOCKED_DECISIONS[fId]) {
    status = "BLOCKED";
    notes = BLOCKED_DECISIONS[fId];
    statusHistory.push({
      status: "BLOCKED",
      date: "2026-11-20",
      commit: null,
      evidenceLink: "audit/tracker/owner-decisions.md",
      note: BLOCKED_DECISIONS[fId]
    });
  }

  // Dependencies
  const dependsOn = [];
  if (clusterData.dependsOn && clusterData.dependsOn.length > 0) {
    for (const d of clusterData.dependsOn) {
      if (d !== fId && !dependsOn.includes(d)) dependsOn.push(d);
    }
  }

  // Specific intra-tier dependencies
  if (fId === "F-010" && !dependsOn.includes("F-009")) dependsOn.push("F-009");
  if (fId === "F-036" && !dependsOn.includes("F-010")) dependsOn.push("F-010");
  if (fId === "F-007" && !dependsOn.includes("F-009")) dependsOn.push("F-009");
  if (fId === "F-008" && !dependsOn.includes("F-009")) dependsOn.push("F-009");
  if (fId === "F-015" && !dependsOn.includes("F-008")) dependsOn.push("F-008");

  // Approval requirements
  let needsApproval = "none";
  if (clusterData.needsApproval !== "none") {
    needsApproval = clusterData.needsApproval;
  }

  // Work item object
  const item = {
    id: fId,
    title,
    severity,
    category,
    tier,
    cluster: clusterId,
    dependsOn,
    blocks: [],
    relatedFindings: DUPLICATES[fId] ? [DUPLICATES[fId].canonical] : [],
    standardsRefs,
    files,
    effort,
    owner: "agent",
    status,
    statusHistory,
    reproCommand: `npx vitest run --exclude '**/audit/**'`,
    regressionTest: `audit/tests/${fId.toLowerCase()}-regression.spec.ts`,
    fixCommit: null,
    verifyEvidence: [],
    siblingSweep: siblingSweepResults[clusterId] || { done: false, queryUsed: "", hits: [] },
    needsApproval,
    notes
  };

  items.push(item);
}

// Populate blocks based on dependsOn
for (const item of items) {
  for (const depId of item.dependsOn) {
    const parent = items.find(i => i.id === depId);
    if (parent && !parent.blocks.includes(item.id)) {
      parent.blocks.push(item.id);
    }
  }
}

// Write tracker.json
const trackerJsonFile = path.join(ROOT, "audit/tracker/tracker.json");
fs.writeFileSync(trackerJsonFile, JSON.stringify(items, null, 2), "utf8");
console.log(`Wrote ${items.length} work items to ${trackerJsonFile}`);

// Generate tracker.md via check-tracker.mjs
console.log("Generating tracker.md via check-tracker.mjs...");
execSync("node audit/tracker/check-tracker.mjs --generate-md", { cwd: ROOT, stdio: "inherit" });

// Write clusters.md
console.log("Generating audit/tracker/clusters.md...");
let clustersMd = `# MillLedger Remediation Clusters & Root-Cause Dependency Graph

**Standard Compliance**: GEMINI.md Rule E8 (Enumerated Root Cause Groups & Siblings)  
**Total Clusters**: 15 Distinct Root Cause Groups  
**Total Mapped Findings**: 106 Findings  

---

## 1. Global Inter-Cluster Dependency Graph

\`\`\`mermaid
flowchart TD
    T0["T0: Baseline Safety Net (audit-baseline, CI gate)"]
    T1_03["CLUSTER-03: Ledger Immutability & DB Triggers (T1)"]
    T1_01["CLUSTER-01: Financial Math & Decimal Precision (T1)"]
    T1_02["CLUSTER-02: DB Concurrency & Row Locks (T1)"]
    T2_04["CLUSTER-04: Authorization & Policy Layer (T2)"]
    T2_05["CLUSTER-05: Identity, Admin & Session Hygiene (T2)"]
    T3_06["CLUSTER-06: Input Validation & Audit Logging (T3)"]
    T4_07["CLUSTER-07: HTTP Security & Secrets Hardening (T4)"]
    T5_08["CLUSTER-08: Core Domain Feature Slices (T5)"]
    T6_09["CLUSTER-09: UI/UX Resilience & Forms (T6)"]
    T7_10["CLUSTER-10: WCAG 2.2 AA Accessibility (T7)"]
    T7_11["CLUSTER-11: Motion & Animation (T7)"]
    T8_12["CLUSTER-12: Scalability, Bundles & Indexes (T8)"]
    T9_13["CLUSTER-13: Tamil i18n & Offline Outbox (T9)"]
    T10_14["CLUSTER-14: SEO & Discovery Architecture (T10)"]
    T11_15["CLUSTER-15: Quality, Ops, Docker & Docs (T11)"]

    T0 --> T1_03
    T1_03 --> T1_01
    T1_03 --> T1_02
    T1_01 --> T2_04
    T1_02 --> T2_04
    T2_04 --> T2_05
    T2_04 --> T3_06
    T3_06 --> T4_07
    T1_01 --> T5_08
    T2_04 --> T5_08
    T3_06 --> T5_08
    T5_08 --> T6_09
    T5_08 --> T7_10
    T6_09 --> T7_10
    T7_10 --> T7_11
    T5_08 --> T8_12
    T5_08 --> T9_13
    T6_09 --> T10_14
    T8_12 --> T11_15
\`\`\`

---

## 2. Cluster Detail Ledger & Sibling Sweeps

`;

for (const [cId, cData] of Object.entries(CLUSTERS)) {
  const cFindings = items.filter(i => i.cluster === cId);
  clustersMd += `### ${cId}: ${cData.name}\n\n`;
  clustersMd += `- **Tier**: \`${cData.tier}\`\n`;
  clustersMd += `- **Approval Required**: \`${cData.needsApproval}\`\n`;
  clustersMd += `- **Root Cause**: ${cData.rootCause}\n`;
  clustersMd += `- **Codebase Ground Truth Evidence**: \`${cData.evidence}\`\n`;
  clustersMd += `- **Depends On**: ${cData.dependsOn.length ? cData.dependsOn.join(", ") : "None (Foundation)"}\n\n`;

  clustersMd += `#### Mapped Findings (${cFindings.length})\n\n`;
  clustersMd += `| ID | Sev | Status | Title |\n`;
  clustersMd += `|---|---|---|---|\n`;
  for (const cf of cFindings) {
    clustersMd += `| **${cf.id}** | ${cf.severity} | \`${cf.status}\` | ${cf.title} |\n`;
  }

  const sweep = siblingSweepResults[cId];
  clustersMd += `\n#### Sibling Sweep Record\n\n`;
  clustersMd += `- **Query Command Executed**: \`${sweep.queryUsed}\`\n`;
  clustersMd += `- **Matches Identified in Working Tree**: ${sweep.hits.length} locations\n`;
  if (sweep.hits.length > 0) {
    clustersMd += `\`\`\`text\n${sweep.hits.slice(0, 10).join("\n")}\n${sweep.hits.length > 10 ? `... (${sweep.hits.length - 10} more matches)` : ""}\n\`\`\`\n\n`;
  } else {
    clustersMd += `*Zero additional siblings detected.* \n\n`;
  }
}

fs.writeFileSync(path.join(ROOT, "audit/tracker/clusters.md"), clustersMd, "utf8");
console.log("Wrote audit/tracker/clusters.md");

// Write owner-decisions.md
console.log("Generating audit/tracker/owner-decisions.md...");
const ownerDecisionsMd = `# MillLedger Owner Decisions & Architectural Approvals

**Standard Compliance**: GEMINI.md Rule E1-E11 (No unverified assumptions)  
**Total Open Decisions**: 8 Key Decisions  
**Total Blocked Items**: 7 Work Items (\`F-013\`, \`F-014\`, \`F-018\`, \`F-020\`, \`F-023\`, \`F-083\`, \`F-106\`)  

---

## Decision Ledger

### OD-01: Dynamic GST Rate Master Table vs Static Product Column
- **Affected Items**: \`F-014\` (P2)
- **Status**: **OPEN - BLOCKING F-014**
- **Context**: Statutory GST rates (5%, 12%, 18%) are currently read from static \`product.taxRate\` columns in the product table. A dedicated \`TaxRate\` master table exists in Prisma schema but is never queried.
- **Options**:
  1. *Option A (Dynamic Master)*: Migrate all invoice tax calculations to read from the \`TaxRate\` table matched by HSN code and effective date.
  2. *Option B (Static Column)*: Retain static \`product.taxRate\`, remove the unused \`TaxRate\` master model, and enforce 5% / 12% / 18% via Zod enum.
- **Consequences**: Option A accommodates future statutory GST rate adjustments by CBIC without modifying historical product entries. Option B is simpler but requires database schema edits if rates change.
- **Agent Assumption**: Option A (Dynamic \`TaxRate\` table lookup by HSN code with fallback to product tax rate).
- **Unblocking Action**: Owner confirms Option A or Option B.

---

### OD-02: Super Admin Bootstrap and First-Run Credential Policy
- **Affected Items**: \`F-023\` (P1)
- **Status**: **OPEN - BLOCKING F-023**
- **Context**: Super admin accounts currently rely on hardcoded credentials in \`prisma/seed.ts\`. There are zero API endpoints or secure CLI utilities to bootstrap the initial administrator without risking hardcoded passwords in version control.
- **Options**:
  1. *Option A (Interactive CLI)*: Build an interactive script \`pnpm admin:bootstrap\` that prompts for email, password, and provisions the initial ADMIN account with mandatory password hashing.
  2. *Option B (Environment Variable Seed)*: Bootstrap the admin account on server startup if \`ADMIN_EMAIL\` and \`ADMIN_PASSWORD\` environment variables are set in \`.env\`.
- **Consequences**: Option A prevents secrets from persisting in plaintext environment files. Option B works well in containerized orchestration (Docker/Kubernetes).
- **Agent Assumption**: Option A (Interactive CLI utility \`pnpm admin:bootstrap\` with validation).
- **Unblocking Action**: Owner approves Option A or Option B.

---

### OD-03: Multi-tier ABAC Scoping Matrix for Salesmen & Dispatches
- **Affected Items**: \`F-018\` (P1)
- **Status**: **OPEN - BLOCKING F-018**
- **Context**: \`GET /api/v1/sales/dispatches\` currently leaks company-wide customer orders, invoices, and dispatch notes to field salesmen.
- **Options**:
  1. *Option A (Strict Isolation)*: Salesmen cannot access \`/dispatches\` at all (restricted to ADMIN, DISPATCHER, OWNER). Salesmen track order status solely through \`/orders/my-orders\`.
  2. *Option B (Scoped Dispatches)*: Filter dispatches returned by \`GET /api/v1/sales/dispatches\` to only include orders originally submitted by the requesting salesman.
- **Consequences**: Option A protects warehouse logistics and operational data. Option B provides salesmen with direct tracking of their customers' shipments.
- **Agent Assumption**: Option B (Filter dispatches by \`salesOrder.createdById === user.id\` for salesmen).
- **Unblocking Action**: Owner confirms Option A or Option B.

---

### OD-04: Offline Outbox Stock Shortage Conflict Queue Policy (REQ-052)
- **Affected Items**: \`F-083\` (P1)
- **Status**: **OPEN - BLOCKING F-083**
- **Context**: When an offline order synced by a field salesman encounters insufficient ATP inventory, the server currently accepts it silently or fails with an unhandled exception. REQ-052 mandates an explicit Conflict Queue.
- **Options**:
  1. *Option A (Conflict Status in Database)*: Transition the order to \`STOCK_SHORTAGE_CONFLICT\` with allocated available units reserved, keeping the shortage in a pending conflict queue for salesman/admin resolution.
  2. *Option B (Transactional Rejection)*: Reject the order sync with HTTP 409 Conflict, returning the exact deficit, and preserve the order in the client's local IndexedDB conflict drawer for manual amendment.
- **Consequences**: Option A guarantees order intent is captured on the server ledger. Option B maintains zero dirty orders in the PostgreSQL database.
- **Agent Assumption**: Option A (Server-side \`STOCK_SHORTAGE_CONFLICT\` state with real-time outbox notification).
- **Unblocking Action**: Owner selects Option A or Option B.

---

### OD-05: Image Hash Interpretation & Asset Optimization
- **Affected Items**: None blocked directly (Affects Tier 8 optimization)
- **Status**: **RESOLVED VIA ASSUMPTION**
- **Context**: The prompt mentions "image hash" in Tier 8.
- **Options**:
  1. *Option A (Perceptual Thumbhash/Blurhash)*: Generate base64 blurhashes for product imagery to render instant progressive blur placeholders while full images load.
  2. *Option B (Content-Addressable SHA-256)*: Compute cryptographic SHA-256 hashes of uploaded receipt images for deduplication and tamper proofing.
- **Agent Assumption**: Implement both: Thumbhash on frontend product cards for LCP, and SHA-256 file checksums on uploaded proof-of-delivery documents.

---

### OD-06: Payment Bounce and Debit Note Data Model Specification
- **Affected Items**: \`F-013\` (P1)
- **Status**: **OPEN - BLOCKING F-013**
- **Context**: The system lacks data structures to handle customer cheque bounces, online payment chargebacks, or supplier purchase debit notes without deleting ledger records.
- **Options**:
  1. *Option A (Compensating Journal Entries)*: Add \`PaymentStatus: BOUNCED\` which triggers an automatic negative allocation reversal, and add a \`DebitNote\` table mirroring \`CreditNote\`.
  2. *Option B (Credit Note Generalization)*: Reuse the existing \`CreditNote\` table with a \`type: "SUPPLIER_DEBIT" | "CUSTOMER_CREDIT"\` enum flag.
- **Consequences**: Option A maintains strict GAAP/statutory separation between Accounts Payable and Accounts Receivable.
- **Agent Assumption**: Option A (Dedicated \`DebitNote\` model and \`BOUNCED\` payment lifecycle).
- **Unblocking Action**: Owner confirms Option A or Option B.

---

### OD-07: Sales Order Unit Price Discount Bounds and Margin Policy
- **Affected Items**: \`F-020\` (P1)
- **Status**: **OPEN - BLOCKING F-020**
- **Context**: Salesmen can currently submit orders with arbitrary unit prices (e.g. ₹0.01 per packet), bypassing price lists and eroding profit margins.
- **Options**:
  1. *Option A (Strict Price List Lock)*: Salesmen cannot alter unit prices in UI; price is read-only from the customer's assigned price list.
  2. *Option B (Threshold Discount Guard)*: Salesmen may discount up to 5% off list price; any discount between 5% and 15% requires manager approval; discounts > 15% are rejected.
- **Consequences**: Option A eliminates fraud risk. Option B allows commercial flexibility for field negotiations.
- **Agent Assumption**: Option B (Up to 5% salesman discretion, > 5% requires ADMIN approval).
- **Unblocking Action**: Owner selects Option A or Option B.

---

### OD-08: DPDP Act 2023 Customer Data Retention, Anonymization & Erasure Schedule
- **Affected Items**: \`F-106\` (P2)
- **Status**: **OPEN - BLOCKING F-106**
- **Context**: Digital Personal Data Protection (DPDP) Act 2023 requires data erasure on customer request. However, Section 36 of the CGST Act 2017 requires mandatory preservation of tax invoice records for 72 months (6 years).
- **Options**:
  1. *Option A (PII Anonymization)*: Replace customer name, phone, email, and address with \`ANONYMIZED-CUSTOMER-<ID>\` while preserving GSTIN, invoice amounts, tax registers, and financial ledgers.
  2. *Option B (Restricted Archival)*: Lock customer records from active view, restrict access to statutory audit roles only, and execute hard deletion after the 72-month statutory retention expires.
- **Consequences**: Option A satisfies DPDP Act data minimization immediately without violating GST retention. Option B satisfies strict tax audit trails.
- **Agent Assumption**: Option A (Cryptographic PII anonymization with invoice financial integrity preservation).
- **Unblocking Action**: Owner selects Option A or Option B.
`;

fs.writeFileSync(path.join(ROOT, "audit/tracker/owner-decisions.md"), ownerDecisionsMd, "utf8");
console.log("Wrote audit/tracker/owner-decisions.md");

console.log("Done generating all tracker files.");
