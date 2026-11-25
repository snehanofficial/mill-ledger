import { prisma } from "../../db/client.js";
import { MovementType, Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
import type {
  UserContext,
  CreateSupplierInput,
  UpdateSupplierInput,
} from "@mill-ledger/shared";
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
  private async resolveOrgId(
    orgIdOrCode?: string,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<string> {
    const target = orgIdOrCode || "MILL";
    const org = await client.organization.findFirst({
      where: {
        OR: [{ id: target }, { code: target }],
      },
    });
    return org ? org.id : target;
  }

  private async resolveWarehouseId(
    warehouseCodeOrId: string | undefined,
    orgId: string,
  ): Promise<string> {
    if (warehouseCodeOrId) {
      const wh = await prisma.warehouse.findFirst({
        where: {
          OR: [{ id: warehouseCodeOrId }, { code: warehouseCodeOrId }],
        },
      });
      if (wh) return wh.id;
    }
    const defaultWh = await prisma.warehouse.findFirst({
      where: { facility: { organizationId: orgId } },
      orderBy: { code: "asc" },
    });
    if (!defaultWh) {
      throw new AppError("No warehouse available for organization", 400);
    }
    return defaultWh.id;
  }

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
    const resolvedOrgId = await this.resolveOrgId(organizationId);
    const items = await prisma.inventoryItem.findMany({
      where: {
        organizationId: resolvedOrgId,
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
   * List suppliers
   */
  async getSuppliers(organizationId: string, includeInactive = false) {
    const orgId = await this.resolveOrgId(organizationId);
    const where: Prisma.SupplierWhereInput = { organizationId: orgId };
    if (!includeInactive) {
      where.isActive = true;
    }
    return await prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseReceipts: {
          take: 10,
          orderBy: { postedAt: "desc" },
        },
      },
    });
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }
    return supplier;
  }

  /**
   * Create a new raw material / mandi vendor supplier (F-038)
   */
  async createSupplier(input: CreateSupplierInput, user?: UserContext) {
    const orgId = await this.resolveOrgId(input.organizationId);

    const existing = await prisma.supplier.findFirst({
      where: {
        organizationId: orgId,
        code: input.code,
      },
    });

    if (existing) {
      throw new AppError(`Supplier code ${input.code} already exists`, 409);
    }

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: orgId,
        code: input.code,
        name: input.name,
        phone: input.phone,
        email: input.email,
        state: input.state,
        gstin: input.gstin,
        isActive: input.isActive ?? true,
      },
    });

    await auditService.log({
      organizationId: orgId,
      userId: user?.id,
      userEmail: user?.email,
      action: "CREATE",
      entity: "Supplier",
      entityId: supplier.id,
      details: {
        code: supplier.code,
        name: supplier.name,
        state: supplier.state,
        gstin: supplier.gstin,
      },
    });

    return supplier;
  }

  /**
   * Update an existing supplier (F-038)
   */
  async updateSupplier(
    id: string,
    input: UpdateSupplierInput,
    user?: UserContext,
  ) {
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError("Supplier not found", 404);
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        phone: input.phone !== undefined ? input.phone : existing.phone,
        email: input.email !== undefined ? input.email : existing.email,
        state: input.state ?? existing.state,
        gstin: input.gstin !== undefined ? input.gstin : existing.gstin,
        isActive:
          input.isActive !== undefined ? input.isActive : existing.isActive,
      },
    });

    await auditService.log({
      organizationId: existing.organizationId,
      userId: user?.id,
      userEmail: user?.email,
      action: "UPDATE",
      entity: "Supplier",
      entityId: updated.id,
      details: {
        changes: input,
      },
    });

    return updated;
  }

  /**
   * Create a new InventoryItem (Raw Material, Packaging, or Finished Goods) with optional opening balance (IMP-012)
   */
  async createInventoryItem(
    input: {
      organizationId?: string;
      sku: string;
      name: string;
      category: "RAW_MATERIAL" | "PACKAGING" | "FINISHED_GOODS";
      baseUomId: string;
      openingStock?: number;
      openingUnitCost?: number;
      warehouseId?: string;
    },
    user?: UserContext,
  ) {
    const orgId = await this.resolveOrgId(input.organizationId || "MILL");
    const warehouseId = await this.resolveWarehouseId(input.warehouseId, orgId);

    const item = await prisma.$transaction(async (tx) => {
      const openingQty =
        input.openingStock && input.openingStock > 0 ? input.openingStock : 0;
      const unitCost =
        input.openingUnitCost && input.openingUnitCost >= 0
          ? input.openingUnitCost
          : 0;

      const created = await tx.inventoryItem.create({
        data: {
          organizationId: orgId,
          sku: input.sku.trim().toUpperCase(),
          name: input.name.trim(),
          category: input.category,
          baseUomId: input.baseUomId,
          currentStock: openingQty,
          weightedAverageCost: unitCost,
        },
        include: { baseUom: true },
      });

      if (openingQty > 0) {
        await tx.stockMovement.create({
          data: {
            inventoryItemId: created.id,
            warehouseId,
            movementType: "OPENING_BALANCE",
            quantity: openingQty,
            unitCost,
            totalCost: openingQty * unitCost,
            referenceDocumentType: "OPENING_BALANCE",
            referenceDocumentId: created.id,
            notes: "Initial opening stock",
          },
        });
      }

      return created;
    });

    await auditService.log({
      organizationId: orgId,
      userId: user?.id,
      userEmail: user?.email,
      action: "CREATE",
      entity: "InventoryItem",
      entityId: item.id,
      details: { sku: item.sku, name: item.name, category: item.category },
    });

    return item;
  }

  /**
   * Update/archive an InventoryItem (IMP-012)
   */
  async updateInventoryItem(
    id: string,
    input: { name?: string; isActive?: boolean },
    user?: UserContext,
  ) {
    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(`Inventory item ${id} not found`, 404);
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        isActive: input.isActive !== undefined ? input.isActive : undefined,
      },
      include: { baseUom: true },
    });

    await auditService.log({
      organizationId: existing.organizationId,
      userId: user?.id,
      userEmail: user?.email,
      action: "UPDATE",
      entity: "InventoryItem",
      entityId: updated.id,
      details: { name: updated.name, isActive: updated.isActive },
    });

    return updated;
  }

  /**
   * Post an audited Stock Adjustment movement atomically (IMP-012)
   */
  async postStockAdjustment(
    input: {
      organizationId?: string;
      warehouseId?: string;
      inventoryItemId: string;
      quantity: number;
      reason: string;
    },
    user?: UserContext,
  ) {
    if (!input.reason || input.reason.trim() === "") {
      throw new AppError("Adjustment reason is required", 400);
    }
    if (!input.quantity || input.quantity === 0) {
      throw new AppError("Adjustment quantity must be non-zero", 400);
    }

    const orgId = await this.resolveOrgId(input.organizationId || "MILL");
    const warehouseId = await this.resolveWarehouseId(input.warehouseId, orgId);

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          currentStock: Prisma.Decimal;
          weightedAverageCost: Prisma.Decimal;
        }>
      >`
        SELECT "id", "currentStock", "weightedAverageCost"
        FROM "inventory_item"
        WHERE "id" = ${input.inventoryItemId}
        FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new AppError("Inventory item not found", 404);
      }

      const currentStock = Number(locked[0].currentStock);
      const unitCost = Number(locked[0].weightedAverageCost);
      const nextStock = currentStock + input.quantity;
      if (nextStock < 0) {
        throw new AppError(
          `Adjustment would result in negative stock (${nextStock})`,
          400,
        );
      }

      const movement = await tx.stockMovement.create({
        data: {
          inventoryItemId: input.inventoryItemId,
          warehouseId,
          movementType: "ADJUSTMENT",
          quantity: input.quantity,
          unitCost,
          totalCost: Math.abs(input.quantity) * unitCost,
          referenceDocumentType: "STOCK_ADJUSTMENT",
          referenceDocumentId: input.inventoryItemId,
          notes: input.reason.trim(),
        },
      });

      const updatedItem = await tx.inventoryItem.update({
        where: { id: input.inventoryItemId },
        data: { currentStock: nextStock },
      });

      return { movement, updatedItem };
    });

    await auditService.log({
      organizationId: orgId,
      userId: user?.id,
      userEmail: user?.email,
      action: "ADJUSTMENT",
      entity: "InventoryItem",
      entityId: input.inventoryItemId,
      reason: input.reason.trim(),
      details: {
        quantity: input.quantity,
        newStock: Number(result.updatedItem.currentStock),
      },
    });

    return result;
  }

  /**
   * List UOMs and UnitConversions (IMP-012)
   */
  async getUomsAndConversions(organizationId = "MILL") {
    const orgId = await this.resolveOrgId(organizationId);
    const [uoms, conversions] = await Promise.all([
      prisma.unitOfMeasure.findMany({
        where: { organizationId: orgId },
        orderBy: { code: "asc" },
      }),
      prisma.unitConversion.findMany({
        where: { fromUom: { organizationId: orgId } },
        include: { fromUom: true, toUom: true },
      }),
    ]);
    return { uoms, conversions };
  }

  async createUom(
    input: { organizationId?: string; code: string; name: string; symbol: string },
    user?: UserContext,
  ) {
    const orgId = await this.resolveOrgId(input.organizationId || "MILL");
    const uom = await prisma.unitOfMeasure.create({
      data: {
        organizationId: orgId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        symbol: input.symbol.trim(),
      },
    });
    await auditService.log({
      organizationId: orgId,
      userId: user?.id,
      userEmail: user?.email,
      action: "CREATE",
      entity: "UnitOfMeasure",
      entityId: uom.id,
      details: { code: uom.code, symbol: uom.symbol },
    });
    return uom;
  }

  async createUnitConversion(
    input: { fromUomId: string; toUomId: string; factor: number },
    user?: UserContext,
  ) {
    if (input.factor <= 0) {
      throw new AppError("Conversion factor must be positive", 400);
    }
    const conversion = await prisma.unitConversion.create({
      data: {
        fromUomId: input.fromUomId,
        toUomId: input.toUomId,
        factor: input.factor,
      },
      include: { fromUom: true, toUom: true },
    });
    await auditService.log({
      organizationId: conversion.fromUom.organizationId,
      userId: user?.id,
      userEmail: user?.email,
      action: "CREATE",
      entity: "UnitConversion",
      entityId: conversion.id,
      details: {
        from: conversion.fromUom.code,
        to: conversion.toUom.code,
        factor: input.factor,
      },
    });
    return conversion;
  }

  /**
   * Get single purchase receipt by ID with lines and debit notes (IMP-015)
   */
  async getPurchaseReceiptById(receiptId: string) {
    const receipt = await prisma.purchaseReceipt.findUnique({
      where: { id: receiptId },
      include: {
        supplier: true,
        warehouse: true,
        lines: {
          include: {
            inventoryItem: { include: { baseUom: true } },
            uom: true,
          },
        },
        debitNotes: true,
      },
    });
    if (!receipt) {
      throw new AppError(`Purchase receipt ${receiptId} not found`, 404);
    }
    return receipt;
  }

  /**
   * Reverse a posted purchase receipt via compensating ADJUSTMENT stock movements (IMP-015)
   */
  async reversePurchaseReceipt(
    receiptId: string,
    reason: string,
    user?: UserContext,
  ) {
    if (!reason || reason.trim() === "") {
      throw new AppError("Reversal reason is required", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.findUnique({
        where: { id: receiptId },
        include: { lines: true },
      });
      if (!receipt) {
        throw new AppError(`Purchase receipt ${receiptId} not found`, 404);
      }

      const existingReversal = await tx.stockMovement.findFirst({
        where: {
          referenceDocumentType: "PURCHASE_REVERSAL",
          referenceDocumentId: receipt.id,
        },
      });
      if (existingReversal) {
        throw new AppError(
          `Purchase receipt ${receipt.receiptNumber} has already been reversed`,
          400,
        );
      }

      const movements = [];
      for (const line of receipt.lines) {
        const locked = await tx.$queryRaw<
          Array<{ id: string; currentStock: Prisma.Decimal }>
        >`
          SELECT "id", "currentStock"
          FROM "inventory_item"
          WHERE "id" = ${line.inventoryItemId}
          FOR UPDATE
        `;
        if (locked.length === 0) {
          throw new AppError("Inventory item not found", 404);
        }

        const qty = Number(line.quantity);
        const currentStock = Number(locked[0].currentStock);
        const nextStock = currentStock - qty;
        if (nextStock < 0) {
          throw new AppError(
            `Cannot reverse receipt ${receipt.receiptNumber}: stock already consumed (available ${currentStock}, receipt ${qty})`,
            400,
          );
        }

        const mv = await tx.stockMovement.create({
          data: {
            inventoryItemId: line.inventoryItemId,
            warehouseId: receipt.warehouseId,
            movementType: "ADJUSTMENT",
            quantity: -qty,
            unitCost: Number(line.unitPrice),
            totalCost: Number(line.totalPrice),
            referenceDocumentType: "PURCHASE_REVERSAL",
            referenceDocumentId: receipt.id,
            notes: `Reversal of ${receipt.receiptNumber}: ${reason.trim()}`,
          },
        });
        movements.push(mv);

        await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: { currentStock: nextStock },
        });
      }

      return {
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        organizationId: receipt.organizationId,
        movements,
      };
    });

    await auditService.log({
      organizationId: result.organizationId,
      userId: user?.id,
      userEmail: user?.email,
      action: "PURCHASE_REVERSAL",
      entity: "PurchaseReceipt",
      entityId: result.receiptId,
      reason: reason.trim(),
      details: { receiptNumber: result.receiptNumber },
    });

    return result;
  }
}

export const inventoryService = new InventoryService();
