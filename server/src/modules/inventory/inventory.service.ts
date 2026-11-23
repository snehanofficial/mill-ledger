import { prisma } from "../../db/client.js";
import { MovementType, Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
import type { UserContext } from "@mill-ledger/shared";
import { auditService } from "../reporting/audit.service.js";

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
  async postPurchaseReceipt(
    input: CreatePurchaseReceiptInput,
    user?: UserContext,
  ) {
    if (!input.items || input.items.length === 0) {
      throw new AppError(
        "Purchase receipt must contain at least one item line",
        400,
      );
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
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

        const items = await tx.$queryRaw<
          Array<{
            id: string;
            name: string;
            sku: string;
            currentStock: Prisma.Decimal.Value;
            weightedAverageCost: Prisma.Decimal.Value;
          }>
        >`SELECT id, name, sku, "currentStock", "weightedAverageCost" FROM "inventory_item" WHERE id = ${itemInput.inventoryItemId} FOR UPDATE`;
        const item = items[0];

        if (!item) {
          throw new AppError(
            `Inventory item ${itemInput.inventoryItemId} not found`,
            404,
          );
        }

        const currentStock = new Prisma.Decimal(item.currentStock || 0);
        const currentAvgCost = new Prisma.Decimal(item.weightedAverageCost || 0);
        const purchasedQty = new Prisma.Decimal(itemInput.quantity);
        const purchaseRate = new Prisma.Decimal(itemInput.unitPrice);
        const lineTotal = purchasedQty.mul(purchaseRate);

        // Exact Weighted Average Cost formula using Decimal arithmetic:
        // (currentStock * currentAvgCost + purchasedQty * purchaseRate) / (currentStock + purchasedQty)
        const totalQty = currentStock.add(purchasedQty);
        const newWeightedAverageCost = totalQty.gt(0)
          ? currentStock.mul(currentAvgCost).add(lineTotal).dividedBy(totalQty)
          : purchaseRate;

        // Update inventory item balances atomically with row lock
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            currentStock: {
              increment: itemInput.quantity,
            },
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

    if (result) {
      await auditService.log({
        organizationId: result.organizationId,
        userId: user?.id,
        userEmail: user?.email,
        action: "CREATE",
        entity: "PurchaseReceipt",
        entityId: result.id,
        details: {
          receiptNumber: result.receiptNumber,
          supplierId: result.supplierId,
          warehouseId: result.warehouseId,
          lineCount: result.lines?.length ?? 0,
        },
      });
    }

    return result;
    } catch (err: unknown) {
      if (
        input.idempotencyKey &&
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "P2002"
      ) {
        const existingReceipt = await prisma.purchaseReceipt.findUnique({
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
      throw err;
    }
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

    if (items.length === 0) {
      return [];
    }

    const itemIds = items.map((i) => i.id);

    // 1. Group movements by item in 1 single SQL query
    const movementWhere: Prisma.StockMovementWhereInput = {
      inventoryItemId: { in: itemIds },
      ...(warehouseId ? { warehouseId } : {}),
    };

    const movementAggs = await prisma.stockMovement.groupBy({
      by: ["inventoryItemId"],
      where: movementWhere,
      _sum: {
        quantity: true,
      },
    });

    const movementMap = new Map<string, number>();
    for (const m of movementAggs) {
      movementMap.set(m.inventoryItemId, Number(m._sum.quantity ?? 0));
    }

    // 2. Group active stock reservations by item in 1 single SQL query (excluding expired ones - F-027)
    const now = new Date();
    const reservationWhere: Prisma.StockReservationWhereInput = {
      inventoryItemId: { in: itemIds },
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(warehouseId ? { warehouseId } : {}),
    };

    const reservationAggs = await prisma.stockReservation.groupBy({
      by: ["inventoryItemId"],
      where: reservationWhere,
      _sum: {
        reservedQuantity: true,
        releasedQuantity: true,
      },
    });

    const reservationMap = new Map<
      string,
      { reservedGross: number; releasedQty: number }
    >();
    for (const r of reservationAggs) {
      reservationMap.set(r.inventoryItemId, {
        reservedGross: Number(r._sum.reservedQuantity ?? 0),
        releasedQty: Number(r._sum.releasedQuantity ?? 0),
      });
    }

    const balances: InventoryBalanceRow[] = [];

    for (const item of items) {
      const ledgerSum = movementMap.get(item.id) ?? 0;
      const onHand = Number(item.currentStock);

      const res = reservationMap.get(item.id) ?? {
        reservedGross: 0,
        releasedQty: 0,
      };
      const reserved = Math.max(0, res.reservedGross - res.releasedQty);
      const available = Math.max(0, onHand - reserved);
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

  /**
   * List purchase receipts with vendor and line details
   */
  async getPurchaseReceipts(organizationId: string) {
    return await prisma.purchaseReceipt.findMany({
      where: { organizationId },
      include: {
        supplier: true,
        warehouse: true,
        lines: {
          include: {
            inventoryItem: {
              include: { baseUom: true },
            },
            uom: true,
          },
        },
      },
      orderBy: { postedAt: "desc" },
    });
  }

  /**
   * List active suppliers
   */
  async getSuppliers(organizationId: string) {
    return await prisma.supplier.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    });
  }
}

export const inventoryService = new InventoryService();
