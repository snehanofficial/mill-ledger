import { prisma } from "../db/client.js";
import { seedBenchmarkMasters } from "../db/seed.js";
import { inventoryService } from "../modules/inventory/inventory.service.js";
import { productionService } from "../modules/production/production.service.js";
import { salesService } from "../modules/sales/sales.service.js";
import { dispatchService } from "../modules/sales/dispatch.service.js";
import { financeService } from "../modules/finance/finance.service.js";
import { paymentService } from "../modules/finance/payment.service.js";
import { reportingService } from "../modules/reporting/reporting.service.js";
async function runBenchmark() {
    console.log("==========================================================");
    console.log(" MillLedger CDI Benchmark Acceptance Oracle Runner");
    console.log(" Target: docs/benchmark.md (100% exact numerical match)");
    console.log("==========================================================\n");
    const results = [];
    // Clean database
    console.log("Cleaning database tables...");
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
    // Seed benchmark master data
    console.log("Seeding benchmark masters and opening stock...");
    await seedBenchmarkMasters();
    const org = await prisma.organization.findUniqueOrThrow({
        where: { code: "MILL" },
    });
    const adminDb = await prisma.user.findFirstOrThrow({
        where: { email: "admin@millledger.local" },
    });
    const salesman1Db = await prisma.user.findFirstOrThrow({
        where: { email: "salesman1@millledger.local" },
    });
    const salesman2Db = await prisma.user.findFirstOrThrow({
        where: { email: "salesman2@millledger.local" },
    });
    const adminUser = {
        id: adminDb.id,
        email: adminDb.email,
        role: "ADMIN",
        isActive: true,
    };
    const salesman1User = {
        id: salesman1Db.id,
        email: salesman1Db.email,
        role: "SALESMAN",
        isActive: true,
    };
    const salesman2User = {
        id: salesman2Db.id,
        email: salesman2Db.email,
        role: "SALESMAN",
        isActive: true,
    };
    const warehouse = await prisma.warehouse.findFirstOrThrow({
        where: { code: "WH-1" },
    });
    const supplierFlour = await prisma.supplier.findFirstOrThrow({
        where: { code: "SUP-FLOUR-1" },
    });
    const flourItem = await prisma.inventoryItem.findFirstOrThrow({
        where: { sku: "RM-FLOUR" },
    });
    const oilItem = await prisma.inventoryItem.findFirstOrThrow({
        where: { sku: "RM-OIL" },
    });
    const spiceItem = await prisma.inventoryItem.findFirstOrThrow({
        where: { sku: "RM-SPICE" },
    });
    const pouchItem = await prisma.inventoryItem.findFirstOrThrow({
        where: { sku: "PKG-POUCH-200G" },
    });
    const cartonItem = await prisma.inventoryItem.findFirstOrThrow({
        where: { sku: "PKG-CARTON" },
    });
    const fgItem = await prisma.inventoryItem.findFirstOrThrow({
        where: { sku: "FG-MURUKKU-200G" },
    });
    const murukkuVariant = await prisma.productVariant.findFirstOrThrow({
        where: { sku: "VAR-MURUKKU-200G" },
    });
    const retailerA = await prisma.customer.findFirstOrThrow({
        where: { code: "CUST-RET-A" },
    });
    const distributorB = await prisma.customer.findFirstOrThrow({
        where: { code: "CUST-DIST-B" },
    });
    // ──────────────────────────────────────────────────────────────────────────
    // Step 1: Purchase 60 kg flour at ₹45/kg
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n[Step 1] Recording purchase receipt: 60 kg flour at ₹45/kg...");
    await inventoryService.postPurchaseReceipt({
        organizationId: org.id,
        supplierId: supplierFlour.id,
        warehouseId: warehouse.id,
        receiptNumber: "PR-2026-0001",
        supplierInvoiceNumber: "INV-SUP-FLOUR-001",
        items: [
            {
                inventoryItemId: flourItem.id,
                quantity: 60,
                uomId: flourItem.baseUomId,
                unitPrice: 45,
            },
        ],
    });
    const flourPostPurchase = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: flourItem.id },
    });
    const avgCostFlour = Number(flourPostPurchase.weightedAverageCost);
    results.push({
        metric: "Flour weighted average cost after purchase",
        expected: "₹43.125 / kg",
        actual: `₹${avgCostFlour.toFixed(3)} / kg`,
        passed: Math.abs(avgCostFlour - 43.125) < 0.001,
    });
    // ──────────────────────────────────────────────────────────────────────────
    // Step 2, 3, 8: Post production run
    // ──────────────────────────────────────────────────────────────────────────
    console.log("[Step 2, 3, 8] Posting production run: 188 good pkts, 6 damaged, 9 cartons...");
    const allRecipes = await prisma.recipe.findMany({
        where: { productVariantId: murukkuVariant.id },
        include: { items: true },
    });
    const recipe = allRecipes.find((r) => r.items.length > 0) ?? allRecipes[0];
    const runResult = await productionService.postProductionRun(undefined, {
        organizationId: org.id,
        warehouseId: warehouse.id,
        recipeId: recipe.id,
        runNumber: "RUN-BENCHMARK-001",
        batchCount: 1,
        actualGoodQty: 188,
        actualRejectedQty: 0,
        directLaborCost: 1200,
        utilityCost: 600,
        notes: "Benchmark production run with yield and oil variances",
        idempotencyKey: "idem-prod-run-001",
        consumedMaterials: [
            { inventoryItemId: flourItem.id, actualQty: 40 },
            { inventoryItemId: oilItem.id, actualQty: 10.5 },
            { inventoryItemId: spiceItem.id, actualQty: 1.2 },
            { inventoryItemId: pouchItem.id, actualQty: 194 },
            { inventoryItemId: cartonItem.id, actualQty: 9 },
        ],
    });
    const postedRun = runResult.run;
    results.push({
        metric: "Production total run cost",
        expected: "₹5,855.00",
        actual: `₹${Number(postedRun.totalRunCost).toFixed(2)}`,
        passed: Number(postedRun.totalRunCost) === 5855,
    });
    const costPerGoodPkt = Number(postedRun.costPerGoodUnit);
    results.push({
        metric: "Cost per good packet (₹5,855 / 188)",
        expected: "≈ ₹31.14",
        actual: `₹${costPerGoodPkt.toFixed(2)}`,
        passed: Math.abs(costPerGoodPkt - 31.143617) < 0.01,
    });
    results.push({
        metric: "Yield variance (-6% flagged)",
        expected: "true",
        actual: String(postedRun.isYieldFlagged),
        passed: postedRun.isYieldFlagged === true,
    });
    const oilMat = postedRun.materials.find((m) => m.inventoryItemId === oilItem.id);
    results.push({
        metric: "Oil variance (+5% flagged)",
        expected: "true",
        actual: String(oilMat?.isVarianceFlagged ?? false),
        passed: oilMat?.isVarianceFlagged === true,
    });
    const fgPostProd = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: fgItem.id },
    });
    results.push({
        metric: "Finished Murukku stock after run (50 + 188)",
        expected: "238 packets",
        actual: `${Number(fgPostProd.currentStock)} packets`,
        passed: Number(fgPostProd.currentStock) === 238,
    });
    // ──────────────────────────────────────────────────────────────────────────
    // Step 4: Salesman 1 submits Retailer A order for 150 packets in Tamil Nadu
    // ──────────────────────────────────────────────────────────────────────────
    console.log("[Step 4] Salesman 1 submits Retailer A order: 150 pkts at ₹50 in Tamil Nadu...");
    const orderResult = await salesService.createSalesOrder({
        organizationId: org.id,
        customerId: retailerA.id,
        warehouseId: warehouse.id,
        orderNumber: "SO-BENCHMARK-001",
        notes: "Benchmark order 1: 150 packets for Retailer A",
        idempotencyKey: "idem-benchmark-order-1",
        lines: [
            {
                productVariantId: murukkuVariant.id,
                quantity: 150,
                unitPrice: 50.0,
            },
        ],
    }, salesman1User);
    const orderA = orderResult.order;
    results.push({
        metric: "Taxable invoice amount (150 pkts × ₹50)",
        expected: "₹7,500.00",
        actual: `₹${Number(orderA.taxableAmount).toFixed(2)}`,
        passed: Number(orderA.taxableAmount) === 7500,
    });
    results.push({
        metric: "CGST (2.5% intra state)",
        expected: "₹187.50",
        actual: `₹${Number(orderA.cgstAmount).toFixed(2)}`,
        passed: Number(orderA.cgstAmount) === 187.5,
    });
    results.push({
        metric: "SGST (2.5% intra state)",
        expected: "₹187.50",
        actual: `₹${Number(orderA.sgstAmount).toFixed(2)}`,
        passed: Number(orderA.sgstAmount) === 187.5,
    });
    results.push({
        metric: "Order total amount (Taxable + CGST + SGST)",
        expected: "₹7,875.00",
        actual: `₹${Number(orderA.totalAmount).toFixed(2)}`,
        passed: Number(orderA.totalAmount) === 7875,
    });
    // ──────────────────────────────────────────────────────────────────────────
    // Step 5: Admin approves, posts invoice, and dispatches
    // ──────────────────────────────────────────────────────────────────────────
    console.log("[Step 5] Admin approves order, posts invoice, and dispatches...");
    await salesService.approveSalesOrder(orderA.id, {}, adminUser);
    const invoice = await financeService.createInvoiceFromOrder({
        salesOrderId: orderA.id,
        notes: "Benchmark posted invoice",
        idempotencyKey: "idem-benchmark-invoice-1",
    });
    if (!invoice) {
        throw new Error("Benchmark invoice generation failed: invoice is null");
    }
    await dispatchService.postDispatch({
        salesOrderId: orderA.id,
        warehouseId: warehouse.id,
        vehicleNumber: "TN-38-BZ-4321",
        driverName: "Senthil Kumar",
        driverPhone: "9876543210",
        notes: "Benchmark complete dispatch",
        idempotencyKey: "idem-benchmark-dispatch-1",
    });
    const fgPostDispatch = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: fgItem.id },
    });
    results.push({
        metric: "Finished stock physical on hand after dispatch (238 - 150)",
        expected: "88 packets",
        actual: `${Number(fgPostDispatch.currentStock)} packets`,
        passed: Number(fgPostDispatch.currentStock) === 88,
    });
    // ──────────────────────────────────────────────────────────────────────────
    // Step 6: Salesman 2 submits Distributor B order for 120 packets in Karnataka
    // ──────────────────────────────────────────────────────────────────────────
    console.log("[Step 6] Salesman 2 submits Distributor B order: 120 pkts in Karnataka...");
    const orderBResult = await salesService.createSalesOrder({
        organizationId: org.id,
        customerId: distributorB.id,
        warehouseId: warehouse.id,
        orderNumber: "SO-BENCHMARK-002",
        notes: "Benchmark order 2: 120 packets for Distributor B",
        idempotencyKey: "idem-benchmark-order-2",
        lines: [
            {
                productVariantId: murukkuVariant.id,
                quantity: 120,
                unitPrice: 50.0,
            },
        ],
    }, salesman2User);
    const shortageB = orderBResult.shortages[0]?.shortage ?? 0;
    results.push({
        metric: "Distributor B stock shortage (120 requested - 88 available)",
        expected: "32 packets",
        actual: `${shortageB} packets`,
        passed: shortageB === 32,
    });
    // ──────────────────────────────────────────────────────────────────────────
    // Step 7: Allocate ₹4,000 payment to Retailer A
    // ──────────────────────────────────────────────────────────────────────────
    console.log("[Step 7] Recording and allocating ₹4,000 payment to Retailer A...");
    await paymentService.recordPayment({
        organizationId: org.id,
        customerId: retailerA.id,
        amount: 4000,
        paymentMode: "BANK_TRANSFER",
        referenceNumber: "NEFT-BENCHMARK-001",
        notes: "Benchmark partial settlement for Retailer A",
        allocations: [
            {
                salesInvoiceId: invoice.id,
                amount: 4000,
            },
        ],
    });
    const updatedInvoice = await prisma.salesInvoice.findUniqueOrThrow({
        where: { id: invoice.id },
    });
    const outstanding = Number(updatedInvoice.outstandingAmount);
    results.push({
        metric: "Retailer A invoice outstanding (₹7,875 - ₹4,000)",
        expected: "₹3,875.00",
        actual: `₹${outstanding.toFixed(2)}`,
        passed: outstanding === 3875,
    });
    // ──────────────────────────────────────────────────────────────────────────
    // Step 9: Reconcile all closing inventory balances with exact oracle
    // ──────────────────────────────────────────────────────────────────────────
    console.log("[Step 9] Reconciling closing inventory balances against oracle...");
    const rawFlour = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: flourItem.id },
    });
    const rawOil = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: oilItem.id },
    });
    const rawSpice = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: spiceItem.id },
    });
    const pkgPouch = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: pouchItem.id },
    });
    const pkgCarton = await prisma.inventoryItem.findUniqueOrThrow({
        where: { id: cartonItem.id },
    });
    results.push({
        metric: "Flour closing balance (100 + 60 - 40)",
        expected: "120 kg",
        actual: `${Number(rawFlour.currentStock)} kg`,
        passed: Number(rawFlour.currentStock) === 120,
    });
    results.push({
        metric: "Oil closing balance (30 - 10.5)",
        expected: "19.5 L",
        actual: `${Number(rawOil.currentStock)} L`,
        passed: Number(rawOil.currentStock) === 19.5,
    });
    results.push({
        metric: "Spice mix closing balance (5 - 1.2)",
        expected: "3.8 kg",
        actual: `${Number(rawSpice.currentStock)} kg`,
        passed: Number(rawSpice.currentStock) === 3.8,
    });
    results.push({
        metric: "Packaging pouch closing balance (500 - 194)",
        expected: "306 pieces",
        actual: `${Number(pkgPouch.currentStock)} pieces`,
        passed: Number(pkgPouch.currentStock) === 306,
    });
    results.push({
        metric: "Carton box closing balance (30 - 9)",
        expected: "21 pieces",
        actual: `${Number(pkgCarton.currentStock)} pieces`,
        passed: Number(pkgCarton.currentStock) === 21,
    });
    // ──────────────────────────────────────────────────────────────────────────
    // Reporting reconciliation
    // ──────────────────────────────────────────────────────────────────────────
    console.log("Verifying sales register and stock valuation reports...");
    const salesReport = await reportingService.getSalesReport({
        organizationId: org.id,
    });
    results.push({
        metric: "Sales register total invoiced",
        expected: "₹7,875.00",
        actual: `₹${salesReport.summary.grandTotal.toFixed(2)}`,
        passed: salesReport.summary.grandTotal === 7875,
    });
    const collectionsReport = await reportingService.getCollectionsReport({
        organizationId: org.id,
    });
    results.push({
        metric: "Collections register total collected",
        expected: "₹4,000.00",
        actual: `₹${collectionsReport.summary.totalAmount.toFixed(2)}`,
        passed: collectionsReport.summary.totalAmount === 4000,
    });
    // ──────────────────────────────────────────────────────────────────────────
    // Summary Table
    // ──────────────────────────────────────────────────────────────────────────
    console.log("\n==========================================================");
    console.log(" Benchmark Acceptance Summary Results");
    console.log("==========================================================");
    let allPassed = true;
    for (const r of results) {
        const status = r.passed ? "[PASS]" : "[FAIL]";
        if (!r.passed)
            allPassed = false;
        console.log(`${status} ${r.metric.padEnd(46)} | Exp: ${r.expected.padEnd(14)} | Act: ${r.actual}`);
    }
    console.log("==========================================================");
    if (allPassed) {
        console.log(" SUCCESS: All 18 benchmark assertions matched 100%!");
        console.log(" Exit code: 0");
        process.exit(0);
    }
    else {
        console.error(" FAILURE: One or more benchmark assertions failed.");
        console.log(" Exit code: 1");
        process.exit(1);
    }
}
runBenchmark().catch((err) => {
    console.error("Fatal benchmark execution error:", err);
    process.exit(1);
});
