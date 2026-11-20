-- Audit-only scale seeder for PostgreSQL: 100k movements, 10k orders, 5k invoices
BEGIN;

-- 1. Insert 100,000 Stock Movements
INSERT INTO stock_movement (
    id, "inventoryItemId", "warehouseId", "movementType",
    quantity, "unitCost", "totalCost",
    "referenceDocumentType", "referenceDocumentId",
    notes, "postedAt", "createdAt"
)
SELECT
    'sm-scale-' || i,
    'cmwnfua14000e3mabrdkopcsz',
    'cmwnfu9zy00023mab22cjz2ww',
    'OPENING_BALANCE'::"MovementType",
    10.000000,
    45.500000,
    455.00,
    'SCALE_AUDIT',
    'REF-' || i,
    'Automated scale test entry',
    NOW() - (i || ' minutes')::interval,
    NOW() - (i || ' minutes')::interval
FROM generate_series(1, 100000) AS s(i);

-- 2. Insert 10,000 Sales Orders
INSERT INTO sales_order (
    id, "organizationId", "orderNumber", "customerId", "salesmanId", "warehouseId",
    status, "fulfilmentStatus", "deliveryState", notes,
    "taxableAmount", "cgstAmount", "sgstAmount", "igstAmount", "totalTaxAmount", "totalAmount",
    "createdAt", "updatedAt"
)
SELECT
    'so-scale-' || i,
    'cmwnfu9g300003mabr2uqrelp',
    'SO-SCALE-' || LPAD(i::text, 6, '0'),
    'cmwnfua0m00093mabuugfbvmy',
    'mHVJCLbgKekSFFVY9aq81JbCEE56qdlc',
    'cmwnfu9zy00023mab22cjz2ww',
    (CASE WHEN i % 3 = 0 THEN 'APPROVED' WHEN i % 3 = 1 THEN 'SUBMITTED' ELSE 'REJECTED' END)::"OrderStatus",
    (CASE WHEN i % 2 = 0 THEN 'FULFILLED' ELSE 'UNFULFILLED' END)::"FulfilmentStatus",
    'Tamil Nadu',
    'Scale test order ' || i,
    1000.00, 25.00, 25.00, 0.00, 50.00, 1050.00,
    NOW() - (i || ' minutes')::interval,
    NOW() - (i || ' minutes')::interval
FROM generate_series(1, 10000) AS s(i);

-- 2b. Insert 10,000 Sales Order Lines
INSERT INTO sales_order_line (
    id, "salesOrderId", "productVariantId", "inventoryItemId",
    "quotedQuantity", "approvedQuantity", "dispatchedQuantity",
    "quotedUnitPrice", "approvedUnitPrice", "taxRate",
    "taxableAmount", "taxAmount", "lineTotal", "createdAt", "updatedAt"
)
SELECT
    'sol-scale-' || i,
    'so-scale-' || i,
    'cmwnfua27000r3mabe87jbfca',
    'cmwnfua14000e3mabrdkopcsz',
    10.0, 10.0, 5.0,
    100.00, 100.00, 5.00,
    1000.00, 50.00, 1050.00,
    NOW() - (i || ' minutes')::interval,
    NOW() - (i || ' minutes')::interval
FROM generate_series(1, 10000) AS s(i);

-- 3. Insert 5,000 Sales Invoices
INSERT INTO sales_invoice (
    id, "organizationId", "invoiceNumber", "financialYear", "salesOrderId",
    "customerId", "customerNameSnapshot", "deliveryStateSnapshot", "companyGstinSnapshot",
    status, currency, "taxableAmount", "cgstAmount", "sgstAmount", "igstAmount",
    "totalTaxAmount", "totalAmount", "paidAmount", "outstandingAmount",
    "postedAt", "createdAt", "updatedAt"
)
SELECT
    'inv-scale-' || i,
    'cmwnfu9g300003mabr2uqrelp',
    'INV-SCALE-' || LPAD(i::text, 6, '0'),
    '2026-27',
    'so-scale-' || i,
    'cmwnfua0m00093mabuugfbvmy',
    'Murugan Stores',
    'Tamil Nadu',
    '33AAAAA0000A1Z5',
    (CASE WHEN i % 4 = 0 THEN 'PAID' WHEN i % 4 = 1 THEN 'PARTIALLY_PAID' WHEN i % 4 = 2 THEN 'POSTED' ELSE 'CANCELLED_BY_CREDIT_NOTE' END)::"InvoiceStatus",
    'INR',
    2000.00, 50.00, 50.00, 0.00, 100.00, 2100.00,
    (CASE WHEN i % 4 = 0 THEN 2100.00 WHEN i % 4 = 1 THEN 1000.00 ELSE 0.00 END),
    (CASE WHEN i % 4 = 0 THEN 0.00 WHEN i % 4 = 1 THEN 1100.00 ELSE 2100.00 END),
    NOW() - (i || ' minutes')::interval,
    NOW() - (i || ' minutes')::interval,
    NOW() - (i || ' minutes')::interval
FROM generate_series(1, 5000) AS s(i);

-- 3b. Insert 5,000 Sales Invoice Lines
INSERT INTO sales_invoice_line (
    id, "invoiceId", "salesOrderLineId", "productVariantId",
    "productNameSnapshot", "hsnCodeSnapshot",
    quantity, "unitPrice", "taxRate",
    "taxableAmount", "cgstAmount", "sgstAmount", "igstAmount", "taxAmount", "lineTotal",
    "createdAt", "updatedAt"
)
SELECT
    'invl-scale-' || i,
    'inv-scale-' || i,
    'sol-scale-' || i,
    'cmwnfua27000r3mabe87jbfca',
    'Murukku 200g Packet',
    '21069099',
    20.0, 100.00, 5.00,
    2000.00, 50.00, 50.00, 0.00, 100.00, 2100.00,
    NOW() - (i || ' minutes')::interval,
    NOW() - (i || ' minutes')::interval
FROM generate_series(1, 5000) AS s(i);

COMMIT;
