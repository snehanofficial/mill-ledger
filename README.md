# MillLedger ERP

MillLedger is an enterprise resource planning and shop floor ledger application designed for food manufacturing mills. Built specifically for the CDI Winter Internship Benchmark, MillLedger models atomic stock ledger movements, BOM production with yield and variance tracking, salesman mobile order capture, strict stock reservations, statutory GST invoicing, payment allocations, and auditor ready reporting.

## Stack Justification

The application is built as a TypeScript modular monolog with React 19 and Vite 6 on the client, and Express 5, Better Auth, Prisma 7, and PostgreSQL on the server.

- **PostgreSQL and Prisma 7**: Food production and inventory ledgering demand ACID transactional integrity and arbitrary precision decimal arithmetic. PostgreSQL enforces foreign keys, row locks, and ledger immutability.
- **Express 5 and Better Auth**: Express 5 provides clean async routing without monkey patching. Better Auth handles secure cookie sessions with role and attribute access controls.
- **React 19 and Tailwind CSS 4**: The frontend delivers instant responsive layouts across 320 px mobile phones, factory tablets, and accounting desktops without heavy external CSS runtimes.
- **Dexie IndexedDB**: Powers durable client side outbox queuing for offline salesman order capture.

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 12+
- PostgreSQL running locally or via connection URL

### Setup and Execution

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
# Copy server environment template and verify DATABASE_URL
cp server/.env.example server/.env

# 3. Run database migrations and seed benchmark data
pnpm --filter @mill-ledger/server prisma migrate deploy
pnpm --filter @mill-ledger/server prisma db seed

# 4. Start frontend and backend concurrently
pnpm dev
```

The frontend runs at `http://localhost:5173` and the backend API runs at `http://localhost:3000`.

### Benchmark Acceptance Runner

Execute the automated benchmark oracle verifying all 18 numerical targets from Section 5 in one command:

```bash
pnpm benchmark
```

### Full Test Suite

```bash
# Run all unit and integration domain tests
pnpm test

# Run Playwright browser end to end tests
pnpm test:e2e

# Run type check across workspaces
pnpm typecheck

# Run linter
pnpm lint
```

## Seed Credentials

All accounts are preconfigured with password `Password123!`:

| Role             | Email                         | Intended Device / Workspace                           |
| ---------------- | ----------------------------- | ----------------------------------------------------- |
| Owner            | `owner@millledger.local`      | Executive Dashboard, P&L, Audit Logs                  |
| Admin / Accounts | `admin@millledger.local`      | Order Approvals, Invoicing, Dispatch, Payments        |
| Production Floor | `production@millledger.local` | Tablet BOM Run Recording, Yield & Variance Flags      |
| Salesman 1 (TN)  | `salesman1@millledger.local`  | Mobile Phone, Retailer A Order Capture (Tamil Nadu)   |
| Salesman 2 (KA)  | `salesman2@millledger.local`  | Mobile Phone, Distributor B Order Capture (Karnataka) |

## Benchmark Verification Results

The automated benchmark runner (`server/src/scripts/run-benchmark.ts`) executes the entire scenario against a clean database and proves exact compliance:

| Metric                                                      | Target / Expected | Actual Result | Status |
| ----------------------------------------------------------- | ----------------- | ------------- | ------ |
| Flour weighted average cost after purchase                  | ₹43.125 / kg      | ₹43.125 / kg  | PASS   |
| Production total run cost                                   | ₹5,855.00         | ₹5,855.00     | PASS   |
| Cost per good packet (₹5,855 / 188)                         | ≈ ₹31.14          | ₹31.14        | PASS   |
| Yield variance (-6% flagged)                                | true              | true          | PASS   |
| Oil variance (+5% flagged)                                  | true              | true          | PASS   |
| Finished Murukku stock after run (50 + 188)                 | 238 packets       | 238 packets   | PASS   |
| Taxable invoice amount (150 pkts × ₹50)                     | ₹7,500.00         | ₹7,500.00     | PASS   |
| CGST (2.5% intra state)                                     | ₹187.50           | ₹187.50       | PASS   |
| SGST (2.5% intra state)                                     | ₹187.50           | ₹187.50       | PASS   |
| Order total amount (Taxable + CGST + SGST)                  | ₹7,875.00         | ₹7,875.00     | PASS   |
| Finished stock physical on hand after dispatch (238 - 150)  | 88 packets        | 88 packets    | PASS   |
| Distributor B stock shortage (120 requested - 88 available) | 32 packets        | 32 packets    | PASS   |
| Retailer A invoice outstanding (₹7,875 - ₹4,000)            | ₹3,875.00         | ₹3,875.00     | PASS   |
| Flour closing balance (100 + 60 - 40)                       | 120 kg            | 120 kg        | PASS   |
| Oil closing balance (30 - 10.5)                             | 19.5 L            | 19.5 L        | PASS   |
| Spice mix closing balance (5 - 1.2)                         | 3.8 kg            | 3.8 kg        | PASS   |
| Packaging pouch closing balance (500 - 194)                 | 306 pieces        | 306 pieces    | PASS   |
| Carton box closing balance (30 - 9)                         | 21 pieces         | 21 pieces     | PASS   |
| Sales register total invoiced                               | ₹7,875.00         | ₹7,875.00     | PASS   |
| Collections register total collected                        | ₹4,000.00         | ₹4,000.00     | PASS   |

## Implemented Scope

### Core Must Haves

- Master records: raw materials, packaging, finished goods, suppliers, customers, and BOM recipes.
- Stock movements: purchase receipts, production consumption, production output, and dispatch. Direct stock overwrites are strictly disallowed.
- Production run recording: yields, damaged items, labor and utility costs, and batch costing.
- Order to cash workflow: mobile sales order creation, admin stock verification, ATP checking, invoice posting, and dispatch.
- FIFO payment allocation against posted invoices.

### Expected Features

- Role based and attribute based access controls across Owner, Admin, Production, and Salesman roles.
- Strict stock reservation preventing double selling.
- Indian GST statutory calculation: CGST, SGST, IGST with inter state and intra state logic.
- Costing and valuation: moving weighted average cost recalculated atomically upon purchase receipt.
- Reporting suite: sales register, GST outward summary, purchase register, stock valuation report, production costing analysis, collections register, customer receivables ageing, owner dashboard, and CSV exports.

### Stretch Goals Delivered

- **Offline Order Capture with Sync Engine**: Dexie IndexedDB client side queue with idempotent server replay, conflict detection, and retry mechanics.
- **Tamil Language Interface**: Full bilingual support toggled on the application shell for floor staff and operators.
- **Non blocking Packaging Mismatch Warning**: Real time notification when carton pack size capacity (9 cartons × 20 = 180 packets) differs from production good output (188 packets).

## Documented Assumptions and Notes

- **Moving Weighted Average Valuation**: Stock valuation uses a moving weighted average. Purchases update the unit cost atomically. Production material consumption uses the unit cost recorded at run time.
- **Finished Goods Opening Valuation**: The benchmark opens with 50 finished packets at zero recorded valuation. Output costing reflects the ₹31.14 per packet cost calculated from the production run.
- **Distributor B Order Policy**: When inventory is insufficient (88 available packets vs 120 requested packets), the order is held in draft state with an explicit shortage banner (32 packets short). Admin approval is rejected by the server with a 400 Insufficient Stock response.
- **Carton Packaging Count**: 9 cartons are consumed in the production run. The application records 9 cartons and surfaces a non blocking alert that 9 cartons pack 180 packets whereas 188 good packets were produced.
