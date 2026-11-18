import { prisma } from "../../db/client.js";
import { MovementType, type Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";

export interface CreatePurchaseReceiptInput {
  organizationId: string;
  supplierId: string;
  warehouseId: string;
  receiptNumber: string;
  supplierInvoiceNumber?: string;
  notes?: string;
  idempotencyKey?: string;
  items: Array<{
    inventoryItemId: string;
    quantity: number;
    uomId: string;
    unitPrice: number;
  }>;
}

export interface InventoryBalanceRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  baseUom: {
    code: string;
    symbol: string;
  };
  onHand: number;
  reserved: number;
  available: number;
  weightedAverageCost: number;
  reconciled: boolean;
  ledgerSum: number;
}

export class InventoryService {
  /**
   * Post a purchase receipt transactionally:
   * 1. Idempotency check
   * 2. Recalculate weighted-average cost for each item
   * 3. Update on-hand current stock
   * 4. Record append-only stock movement
   * 5. Create receipt and line records
   */
  async postPurchaseReceipt(input: CreatePurchaseReceiptInput) {
    if (!input.items || input.items.length === 0) {
      throw new AppError(
        "Purchase receipt must contain at least one item line",
        400,
      );
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      if (input.idempotencyKey) {
        const existingReceipt = await tx.purchaseReceipt.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            lines: {
              include: {
                inventoryItem: true,
                uom: true,
              },
            },
          },
        });

        if (existingReceipt) {
          return existingReceipt;
        }
      }

      // Verify supplier and warehouse exist
      const supplier = await tx.supplier.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier) {
        throw new AppError(`Supplier ${input.supplierId} not found`, 404);
      }

      const warehouse = await tx.warehouse.findUnique({
        where: { id: input.warehouseId },
      });
      if (!warehouse) {
        throw new AppError(`Warehouse ${input.warehouseId} not found`, 404);
      }

      // Calculate total amount
      let totalAmount = 0;
      for (const line of input.items) {
        totalAmount += line.quantity * line.unitPrice;
      }

      // Create purchase receipt header
      const receipt = await tx.purchaseReceipt.create({
        data: {
          organizationId: input.organizationId,
          supplierId: input.supplierId,
          warehouseId: input.warehouseId,
          receiptNumber: input.receiptNumber,
          supplierInvoiceNumber: input.supplierInvoiceNumber,
          totalAmount: totalAmount,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
          status: "POSTED",
        },
      });

      // Process each line item
      for (const itemInput of input.items) {
        if (itemInput.quantity <= 0) {
          throw new AppError(
            "Purchase quantity must be greater than zero",
            400,
          );
        }
        if (itemInput.unitPrice < 0) {
          throw new AppError("Purchase unit price cannot be negative", 400);
        }

        const item = await tx.inventoryItem.findUnique({
          where: { id: itemInput.inventoryItemId },
        });

        if (!item) {
          throw new AppError(
            `Inventory item ${itemInput.inventoryItemId} not found`,
            404,
          );
        }

        const currentStock = Number(item.currentStock);
        const currentAvgCost = Number(item.weightedAverageCost);
        const purchasedQty = itemInput.quantity;
        const purchaseRate = itemInput.unitPrice;
        const lineTotal = purchasedQty * purchaseRate;

        // Weighted Average Cost formula:
        // (currentStock * currentAvgCost + purchasedQty * purchaseRate) / (currentStock + purchasedQty)
        const totalQty = currentStock + purchasedQty;
        const newWeightedAverageCost =
          totalQty > 0
            ? (currentStock * currentAvgCost + lineTotal) / totalQty
            : purchaseRate;

        // Update inventory item balances
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            currentStock: totalQty,
            weightedAverageCost: newWeightedAverageCost,
          },
        });

        // Create receipt line
        await tx.purchaseReceiptLine.create({
          data: {
            purchaseReceiptId: receipt.id,
            inventoryItemId: item.id,
            quantity: purchasedQty,
            uomId: itemInput.uomId,
            unitPrice: purchaseRate,
            totalPrice: lineTotal,
          },
        });

        // Record append-only stock movement
        await tx.stockMovement.create({
          data: {
            inventoryItemId: item.id,
            warehouseId: input.warehouseId,
            movementType: MovementType.PURCHASE_RECEIPT,
            quantity: purchasedQty,
            unitCost: purchaseRate,
            totalCost: lineTotal,
            referenceDocumentType: "PURCHASE_RECEIPT",
            referenceDocumentId: receipt.id,
            notes: `Purchase receipt ${input.receiptNumber} from ${supplier.name}`,
          },
        });
      }

      return await tx.purchaseReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
        include: {
          lines: {
            include: {
              inventoryItem: true,
              uom: true,
            },
          },
        },
      });
    });
  }

  /**
   * Retrieve inventory balances with ledger reconciliation proof
   */
  async getInventoryBalances(
    organizationId: string,
    warehouseId?: string,
  ): Promise<InventoryBalanceRow[]> {
    const items = await prisma.inventoryItem.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        baseUom: true,
      },
      orderBy: { sku: "asc" },
    });

    const balances: InventoryBalanceRow[] = [];

    for (const item of items) {
      // Sum movements from ledger to verify deterministic reconciliation
      const movementWhere: Prisma.StockMovementWhereInput = {
        inventoryItemId: item.id,
      };
      if (warehouseId) {
        movementWhere.warehouseId = warehouseId;
      }

      const movementAgg = await prisma.stockMovement.aggregate({
        where: movementWhere,
        _sum: {
          quantity: true,
        },
      });

      const ledgerSum = Number(movementAgg._sum.quantity ?? 0);
      const onHand = Number(item.currentStock);
      const reserved = 0; // Will be connected in M5 reservations
      const available = onHand - reserved;
      const reconciled = Math.abs(onHand - ledgerSum) < 0.000001;

      balances.push({
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        baseUom: {
          code: item.baseUom.code,
          symbol: item.baseUom.symbol,
        },
        onHand,
        reserved,
        available,
        weightedAverageCost: Number(item.weightedAverageCost),
        reconciled,
        ledgerSum,
      });
    }

    return balances;
  }

  /**
   * Retrieve chronological stock ledger movements for an item
   */
  async getItemLedger(itemId: string, warehouseId?: string) {
    const where: Prisma.StockMovementWhereInput = {
      inventoryItemId: itemId,
    };
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      orderBy: { postedAt: "asc" },
      include: {
        warehouse: true,
      },
    });

    let runningBalance = 0;
    return movements.map((m) => {
      const qty = Number(m.quantity);
      runningBalance += qty;

      return {
        id: m.id,
        movementType: m.movementType,
        quantity: qty,
        unitCost: Number(m.unitCost),
        totalCost: Number(m.totalCost),
        runningBalance,
        referenceDocumentType: m.referenceDocumentType,
        referenceDocumentId: m.referenceDocumentId,
        notes: m.notes,
        warehouseName: m.warehouse.name,
        postedAt: m.postedAt,
      };
    });
  }
}

export const inventoryService = new InventoryService();
