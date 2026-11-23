import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "./app.js";
import { createServer } from "node:http";
import { prisma } from "./db/client.js";
import { seedBenchmarkMasters } from "./db/seed.js";
describe("M8: Reporting, audit logs, and owner dashboard", () => {
    let server;
    let baseUrl;
    beforeAll(async () => {
        // 1. Reset all operational data in correct order
        await prisma.auditLog.deleteMany();
        await prisma.paymentAllocation.deleteMany();
        await prisma.payment.deleteMany();
        await prisma.creditNote.deleteMany();
        await prisma.dispatchLine.deleteMany();
        await prisma.dispatch.deleteMany();
        await prisma.salesInvoiceLine.deleteMany();
        await prisma.salesInvoice.deleteMany();
        await prisma.stockReservation.deleteMany();
        await prisma.salesOrderLine.deleteMany();
        await prisma.salesOrder.deleteMany();
        await prisma.productionRunReversal.deleteMany();
        await prisma.productionRunMaterial.deleteMany();
        await prisma.productionRun.deleteMany();
        await prisma.purchaseReceiptLine.deleteMany();
        await prisma.purchaseReceipt.deleteMany();
        await prisma.stockMovement.deleteMany({
            where: {
                movementType: { not: "OPENING_BALANCE" },
            },
        });
        await seedBenchmarkMasters();
        const app = createApp();
        server = createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
    });
    afterAll(async () => {
        await new Promise((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
    });
    async function loginAndGetCookie(email, password) {
        const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        return res.headers.get("set-cookie") ?? "";
    }
    it("executes full benchmark transactions 1 to 7 and reconciles all reporting registers and dashboard", async () => {
        const org = await prisma.organization.findUniqueOrThrow({
            where: { code: "MILL" },
        });
        const warehouse = await prisma.warehouse.findFirstOrThrow({
            where: { code: "WH-1" },
        });
        const supplier = await prisma.supplier.findFirstOrThrow({
            where: { code: "SUP-FLOUR-1" },
        });
        const flour = await prisma.inventoryItem.findFirstOrThrow({
            where: { sku: "RM-FLOUR" },
        });
        const oil = await prisma.inventoryItem.findFirstOrThrow({
            where: { sku: "RM-OIL" },
        });
        const spice = await prisma.inventoryItem.findFirstOrThrow({
            where: { sku: "RM-SPICE" },
        });
        const pouch = await prisma.inventoryItem.findFirstOrThrow({
            where: { sku: "PKG-POUCH-200G" },
        });
        const carton = await prisma.inventoryItem.findFirstOrThrow({
            where: { sku: "PKG-CARTON" },
        });
        const kgUom = await prisma.unitOfMeasure.findFirstOrThrow({
            where: { code: "KG" },
        });
        const retailerA = await prisma.customer.findFirstOrThrow({
            where: { code: "CUST-RET-A" },
        });
        const murukkuVariant = await prisma.productVariant.findFirstOrThrow({
            where: { sku: "VAR-MURUKKU-200G" },
        });
        const recipe = await prisma.recipe.findFirstOrThrow({
            where: { organizationId: org.id, version: 1 },
        });
        const adminCookie = await loginAndGetCookie("admin@millledger.local", "AdminPassword123!");
        const salesman1Cookie = await loginAndGetCookie("salesman1@millledger.local", "SalesmanPassword123!");
        // 1. Transaction 1: Purchase 60 kg flour at ₹45
        const purchaseRes = await fetch(`${baseUrl}/api/v1/inventory/purchase-receipts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: adminCookie,
            },
            body: JSON.stringify({
                organizationId: org.id,
                supplierId: supplier.id,
                warehouseId: warehouse.id,
                receiptNumber: "PR-REP-001",
                supplierInvoiceNumber: "INV-SUP-REP-01",
                items: [
                    {
                        inventoryItemId: flour.id,
                        quantity: 60,
                        uomId: kgUom.id,
                        unitPrice: 45,
                    },
                ],
            }),
        });
        expect(purchaseRes.status).toBe(201);
        // 2. Transaction 2 & 3: Production run 188 packets
        const prodRes = await fetch(`${baseUrl}/api/v1/production-runs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: adminCookie,
            },
            body: JSON.stringify({
                organizationId: org.id,
                warehouseId: warehouse.id,
                recipeId: recipe.id,
                runNumber: "RUN-REP-001",
                batchCount: 1,
                actualGoodQty: 188,
                actualRejectedQty: 0,
                directLaborCost: 1200,
                utilityCost: 600,
                consumedMaterials: [
                    { inventoryItemId: flour.id, actualQty: 40 },
                    { inventoryItemId: oil.id, actualQty: 10.5 },
                    { inventoryItemId: spice.id, actualQty: 1.2 },
                    { inventoryItemId: pouch.id, actualQty: 194, damagedQty: 6 },
                    { inventoryItemId: carton.id, actualQty: 9 },
                ],
            }),
        });
        expect(prodRes.status).toBe(201);
        // 3. Transaction 4: Salesman 1 submits Retailer A order (150 packets at ₹50)
        const orderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: salesman1Cookie,
            },
            body: JSON.stringify({
                organizationId: org.id,
                customerId: retailerA.id,
                warehouseId: warehouse.id,
                orderNumber: "SO-REP-001",
                lines: [
                    {
                        productVariantId: murukkuVariant.id,
                        quantity: 150,
                        unitPrice: 50.0,
                    },
                ],
            }),
        });
        expect(orderRes.status).toBe(201);
        const orderData = (await orderRes.json());
        const orderId = orderData.order.id;
        // 4. Transaction 5: Approve, Invoice (₹7,875), and Dispatch (238 -> 88)
        await fetch(`${baseUrl}/api/v1/sales/orders/${orderId}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: adminCookie },
            body: JSON.stringify({}),
        });
        const invoiceRes = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: adminCookie },
            body: JSON.stringify({ salesOrderId: orderId }),
        });
        expect(invoiceRes.status).toBe(201);
        await fetch(`${baseUrl}/api/v1/sales/dispatches`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: adminCookie },
            body: JSON.stringify({
                salesOrderId: orderId,
                vehicleNumber: "TN-38-BZ-1111",
            }),
        });
        // 5. Transaction 7: Allocate ₹4,000 payment from Retailer A
        const payRes = await fetch(`${baseUrl}/api/v1/payments`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: adminCookie },
            body: JSON.stringify({
                customerId: retailerA.id,
                amount: 4000,
                paymentMode: "BANK_TRANSFER",
                referenceNumber: "UTR-REP-001",
            }),
        });
        expect(payRes.status).toBe(201);
        // ── REPORT ASSERTIONS ──────────────────────────────────────────
        // A. Sales Report
        const salesRes = await fetch(`${baseUrl}/api/v1/reports/sales`, {
            headers: { Cookie: adminCookie },
        });
        expect(salesRes.status).toBe(200);
        const sales = await salesRes.json();
        expect(sales.summary.totalInvoicesCount).toBe(1);
        expect(sales.summary.totalQuantity).toBe(150);
        expect(sales.summary.totalTaxable).toBe(7500);
        expect(sales.summary.totalCGST).toBe(187.5);
        expect(sales.summary.totalSGST).toBe(187.5);
        expect(sales.summary.totalIGST).toBe(0);
        expect(sales.summary.grandTotal).toBe(7875);
        // B. GST Outward Reconciliation Summary
        const gstRes = await fetch(`${baseUrl}/api/v1/reports/gst`, {
            headers: { Cookie: adminCookie },
        });
        expect(gstRes.status).toBe(200);
        const gst = await gstRes.json();
        expect(gst.summary.totalTaxable).toBe(7500);
        expect(gst.summary.totalTaxAmount).toBe(375);
        expect(gst.b2bSupplies.length).toBe(1);
        expect(gst.b2bSupplies[0].supplyType).toBe("Intra State");
        expect(gst.rateBreakup).toHaveLength(1);
        expect(gst.rateBreakup[0].ratePct).toBe(5);
        expect(gst.rateBreakup[0].taxable).toBe(7500);
        // C. Purchase Report
        const purchRes = await fetch(`${baseUrl}/api/v1/reports/purchase`, {
            headers: { Cookie: adminCookie },
        });
        expect(purchRes.status).toBe(200);
        const purch = await purchRes.json();
        expect(purch.summary.totalReceiptsCount).toBe(1);
        expect(purch.summary.totalQuantity).toBe(60);
        expect(purch.summary.totalPurchaseAmount).toBe(2700);
        // D. Stock Summary and Valuation
        const stockRes = await fetch(`${baseUrl}/api/v1/reports/stock`, {
            headers: { Cookie: adminCookie },
        });
        expect(stockRes.status).toBe(200);
        const stock = await stockRes.json();
        expect(stock.summary.allReconciled).toBe(true);
        const flourRow = stock.rows.find((r) => r.sku === "RM-FLOUR");
        expect(flourRow.onHand).toBe(120);
        expect(flourRow.weightedAverageCost).toBe(43.125);
        expect(flourRow.totalValuation).toBe(5175);
        expect(flourRow.isReconciled).toBe(true);
        const fgRow = stock.rows.find((r) => r.sku === "FG-MURUKKU-200G");
        expect(fgRow.onHand).toBe(88);
        expect(fgRow.isReconciled).toBe(true);
        // E. Production Report
        const prodRepRes = await fetch(`${baseUrl}/api/v1/reports/production`, {
            headers: { Cookie: adminCookie },
        });
        expect(prodRepRes.status).toBe(200);
        const prodRep = await prodRepRes.json();
        expect(prodRep.summary.totalGoodQuantity).toBe(188);
        expect(prodRep.summary.totalRunCost).toBe(5855);
        expect(prodRep.summary.totalLaborCost).toBe(1200);
        expect(prodRep.summary.totalGasPowerCost).toBe(600);
        expect(prodRep.rows[0].yieldVariancePct).toBe(-6);
        // F. Collections Report
        const collRes = await fetch(`${baseUrl}/api/v1/reports/collections`, {
            headers: { Cookie: adminCookie },
        });
        expect(collRes.status).toBe(200);
        const coll = await collRes.json();
        expect(coll.summary.totalAmount).toBe(4000);
        expect(coll.summary.totalAllocated).toBe(4000);
        expect(coll.summary.totalUnallocated).toBe(0);
        // G. Receivables Report
        const recRes = await fetch(`${baseUrl}/api/v1/reports/receivables`, {
            headers: { Cookie: adminCookie },
        });
        expect(recRes.status).toBe(200);
        const rec = await recRes.json();
        expect(rec.summary.totalOutstanding).toBe(3875);
        const retARow = rec.rows.find((r) => r.customerCode === "CUST-RET-A");
        expect(retARow.netOutstanding).toBe(3875);
        // H. Owner Executive Dashboard (/api/v1/reports/dashboard and /api/v1/dashboard)
        const dashRes = await fetch(`${baseUrl}/api/v1/reports/dashboard`, {
            headers: { Cookie: adminCookie },
        });
        expect(dashRes.status).toBe(200);
        const dash = await dashRes.json();
        expect(dash.metrics.totalRevenue).toBe(7875);
        expect(dash.metrics.totalCollections).toBe(4000);
        expect(dash.metrics.totalOutstandingReceivables).toBe(3875);
        expect(dash.metrics.stockReconciliationOk).toBe(true);
        // Verify /api/v1/dashboard direct alias (used by frontend dashboard-page)
        const directDashRes = await fetch(`${baseUrl}/api/v1/dashboard?organizationId=MILL`, {
            headers: { Cookie: adminCookie },
        });
        expect(directDashRes.status).toBe(200);
        const directDash = await directDashRes.json();
        expect(directDash.metrics.totalRevenue).toBe(7875);
        // I. CSV Export Engine
        const exportRes = await fetch(`${baseUrl}/api/v1/reports/sales/export?format=csv`, {
            headers: { Cookie: adminCookie },
        });
        expect(exportRes.status).toBe(200);
        expect(exportRes.headers.get("content-type")).toContain("text/csv");
        const csvText = await exportRes.text();
        expect(csvText).toContain("Sales Register");
        expect(csvText).toContain("7875");
        // J. Audit Log Report
        const auditRes = await fetch(`${baseUrl}/api/v1/reports/audit`, {
            headers: { Cookie: adminCookie },
        });
        expect(auditRes.status).toBe(200);
        const auditData = await auditRes.json();
        expect(auditData.logs.length).toBeGreaterThan(0);
        const exportLog = auditData.logs.find((l) => l.action === "EXPORT");
        expect(exportLog).toBeDefined();
    });
    it("enforces role scoping: salesman and production scopes cannot access restricted reports", async () => {
        const salesman1Cookie = await loginAndGetCookie("salesman1@millledger.local", "SalesmanPassword123!");
        const prodCookie = await loginAndGetCookie("production@millledger.local", "ProductionPassword123!");
        // 1. Salesman cannot access purchase, production, gst, or audit reports (403)
        const salesPurchRes = await fetch(`${baseUrl}/api/v1/reports/purchase`, {
            headers: { Cookie: salesman1Cookie },
        });
        expect(salesPurchRes.status).toBe(403);
        const salesAuditRes = await fetch(`${baseUrl}/api/v1/reports/audit`, {
            headers: { Cookie: salesman1Cookie },
        });
        expect(salesAuditRes.status).toBe(403);
        // 2. Salesman CAN access their own sales report (200)
        const salesRepRes = await fetch(`${baseUrl}/api/v1/reports/sales`, {
            headers: { Cookie: salesman1Cookie },
        });
        expect(salesRepRes.status).toBe(200);
        // 3. Production supervisor cannot access sales, gst, receivables, or audit reports (403)
        const prodSalesRes = await fetch(`${baseUrl}/api/v1/reports/sales`, {
            headers: { Cookie: prodCookie },
        });
        expect(prodSalesRes.status).toBe(403);
        // 4. Production supervisor CAN access production report (200)
        const prodRepRes = await fetch(`${baseUrl}/api/v1/reports/production`, {
            headers: { Cookie: prodCookie },
        });
        expect(prodRepRes.status).toBe(200);
        // 5. MLD-007: Salesman 1 querying receivables receives only their assigned accounts
        const sales1RecRes = await fetch(`${baseUrl}/api/v1/reports/receivables`, {
            headers: { Cookie: salesman1Cookie },
        });
        expect(sales1RecRes.status).toBe(200);
        const sales1Rec = await sales1RecRes.json();
        const customerCodes = sales1Rec.rows.map((r) => r.customerCode);
        expect(customerCodes).toContain("CUST-RET-A");
        expect(customerCodes).not.toContain("CUST-DIST-B");
        // 6. MLD-007: Salesman attempting to query another salesman's ID is locked to their own
        const spoofRecRes = await fetch(`${baseUrl}/api/v1/reports/receivables?salesmanId=spoofed-id`, {
            headers: { Cookie: salesman1Cookie },
        });
        expect(spoofRecRes.status).toBe(200);
        const spoofRec = await spoofRecRes.json();
        const spoofCodes = spoofRec.rows.map((r) => r.customerCode);
        expect(spoofCodes).toContain("CUST-RET-A");
        expect(spoofCodes).not.toContain("CUST-DIST-B");
    });
});
