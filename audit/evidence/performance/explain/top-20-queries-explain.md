# PostgreSQL Query Performance & EXPLAIN (ANALYZE, BUFFERS) Report

- **Database**: `mill_ledger_audit_throwaway`
- **Scale Baseline**: 100,007 Stock Movements, 10,011 Sales Orders, 5,006 Sales Invoices
- **Date**: 2026-11-19

| Query ID | Name | Category | Execution (ms) | Planning (ms) | Node Types | Seq Scan Detected? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Q01** | Sales Register Aggregation | Reporting | 1.16 | 0.29 | `Aggregate, Seq Scan` | 🚨 **YES (Missing Index)** |
| **Q02** | Sales Register Invoices Fetch | Reporting | 1.79 | 0.11 | `Sort, Seq Scan` | 🚨 **YES (Missing Index)** |
| **Q03** | GSTR-1 Outward Supplies Aggregation | Reporting / Statutory | 1.48 | 0.08 | `Aggregate, Seq Scan` | 🚨 **YES (Missing Index)** |
| **Q04** | Stock Summary Item Master | Inventory | 0.02 | 0.09 | `Bitmap Heap Scan, Bitmap Index Scan` | ✓ No |
| **Q05** | Stock Movement Ledger By Item (100k Table) | Inventory / Ledger | 37.63 | 0.12 | `Sort, Seq Scan` | 🚨 **YES (Missing Index)** |
| **Q06** | Stock Movement Sum & Count Aggregation (100k Table) | Inventory / Ledger | 12.31 | 0.10 | `Aggregate, Seq Scan` | 🚨 **YES (Missing Index)** |
| **Q07** | ATP Check Active Stock Reservations | Sales / Inventory | 0.02 | 0.13 | `Aggregate, Index Scan` | ✓ No |
| **Q08** | Sales Orders List (Admin View - 10k Orders) | Sales | 3.23 | 0.14 | `Sort, Seq Scan` | 🚨 **YES (Missing Index)** |
| **Q09** | Sales Orders Filtered by Status (10k Orders) | Sales | 1.25 | 0.04 | `Sort, Bitmap Heap Scan, Bitmap Index Scan` | ✓ No |
| **Q10** | Sales Orders by Salesman (Field Sales) | Sales | 0.90 | 0.05 | `Sort, Bitmap Heap Scan, Bitmap Index Scan` | ✓ No |
| **Q11** | Sales Order Lines By Order ID | Sales | 0.62 | 0.07 | `Seq Scan` | 🚨 **YES (Missing Index)** |
| **Q12** | Sales Invoices List (Admin View - 5k Invoices) | Finance | 1.23 | 0.04 | `Sort, Seq Scan` | 🚨 **YES (Missing Index)** |
| **Q13** | Customer Invoices List (5k Invoices) | Finance | 1.23 | 0.03 | `Sort, Seq Scan` | 🚨 **YES (Missing Index)** |
| **Q14** | FIFO Allocation - Open Invoices (5k Invoices) | Finance | 1.33 | 0.09 | `Sort, Seq Scan` | 🚨 **YES (Missing Index)** |
| **Q15** | Customer Payment Allocations Join | Finance | 0.84 | 0.14 | `Hash Join, Seq Scan, Hash` | 🚨 **YES (Missing Index)** |
| **Q16** | Collections Register Payments Query | Finance / Reporting | 0.02 | 0.11 | `Sort, Index Scan` | ✓ No |
| **Q17** | Receivables Overdue Invoices Query (5k Invoices) | Finance / Reporting | 0.80 | 0.03 | `Seq Scan` | 🚨 **YES (Missing Index)** |
| **Q18** | Production Runs List | Production | 0.02 | 0.14 | `Sort, Index Scan` | ✓ No |
| **Q19** | Dispatches List with Organization Filter | Dispatch | 0.01 | 0.09 | `Sort, Index Scan` | ✓ No |
| **Q20** | Audit Log Paginated Query | Audit | 0.02 | 0.10 | `Limit, Index Scan` | ✓ No |
