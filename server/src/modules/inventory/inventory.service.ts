import { prisma } from "../../db/client.js";
import { MovementType, Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
import type {
  UserContext,
  CreateSupplierInput,
  UpdateSupplierInput,
  CreateStockTransferInput,
} from "@mill-ledger/shared";
import { auditService } from "../reporting/audit.service.js";
import { sequenceService } from "../finance/sequence.service.js";
import {
  buildPaginationMeta,
  normalizePaginationOptions,
  paginateArray,
} from "../../utils/pagination.js";
import {
  adjustWarehouseOnHand,
  getWarehouseItemBalance,
  requireActiveOrgWarehouse,
} from "./warehouse-balance.helper.js";

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
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<string> {
    if (warehouseCodeOrId) {
      const wh = await client.warehouse.findFirst({
        where: {
          organizationId: orgId,
          OR: [{ id: warehouseCodeOrId }, { code: warehouseCodeOrId }],
        },
      });
      if (!wh) {
        throw new AppError(
          `Warehouse ${warehouseCodeOrId} not found in organization`,
          404,
        );
      }
      if (!wh.isActive) {
        throw new AppError(`Warehouse ${wh.code} is inactive`, 400);
      }
      return wh.id;
    }
    const defaultWh = await client.warehouse.findFirst({
      where: { organizationId: orgId, isActive: true },
      orderBy: { code: "asc" },
    });
    if (!defaultWh) {
      throw new AppError("No active warehouse available for organization", 400);
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

      // Verify supplier, organization, and warehouse exist (resolving code or ID)
      const resolvedOrgId = await this.resolveOrgId(input.organizationId);
      const resolvedWarehouseId = await this.resolveWarehouseId(
        input.warehouseId,
        resolvedOrgId,
      );

      const supplier = await tx.supplier.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier) {
        throw new AppError(`Supplier ${input.supplierId} not found`, 404);
      }

      const warehouse = await tx.warehouse.findUnique({
        where: { id: resolvedWarehouseId },
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
          organizationId: resolvedOrgId,
          supplierId: input.supplierId,
          warehouseId: resolvedWarehouseId,
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
            baseUomId: string;
            currentStock: Prisma.Decimal.Value;
            weightedAverageCost: Prisma.Decimal.Value;
          }>
        >`SELECT id, name, sku, "baseUomId", "currentStock", "weightedAverageCost" FROM "inventory_item" WHERE id = ${itemInput.inventoryItemId} FOR UPDATE`;
        const item = items[0];

        if (!item) {
          throw new AppError(
            `Inventory item ${itemInput.inventoryItemId} not found`,
            404,
          );
        }

        // Resolve UOM by ID or code and normalize quantity to item's baseUomId
        const enteredUom = await tx.unitOfMeasure.findFirst({
          where: {
            organizationId: resolvedOrgId,
            OR: [{ id: itemInput.uomId }, { code: itemInput.uomId }],
          },
        });
        if (!enteredUom) {
          throw new AppError(`UOM ${itemInput.uomId} not found`, 404);
        }

        let conversionFactor = new Prisma.Decimal(1);
        if (enteredUom.id !== item.baseUomId) {
          const directConv = await tx.unitConversion.findUnique({
            where: {
              fromUomId_toUomId: {
                fromUomId: enteredUom.id,
                toUomId: item.baseUomId,
              },
            },
          });
          if (directConv) {
            conversionFactor = new Prisma.Decimal(directConv.factor);
          } else {
            const reverseConv = await tx.unitConversion.findUnique({
              where: {
                fromUomId_toUomId: {
                  fromUomId: item.baseUomId,
                  toUomId: enteredUom.id,
                },
              },
            });
            if (reverseConv) {
              conversionFactor = new Prisma.Decimal(1).dividedBy(
                new Prisma.Decimal(reverseConv.factor),
              );
            } else {
              throw new AppError(
                `No unit conversion configured between ${enteredUom.code} and base UOM for ${item.name}`,
                400,
              );
            }
          }
        }

        const currentStock = new Prisma.Decimal(item.currentStock || 0);
        const currentAvgCost = new Prisma.Decimal(item.weightedAverageCost || 0);
        const enteredQty = new Prisma.Decimal(itemInput.quantity);
        const enteredRate = new Prisma.Decimal(itemInput.unitPrice);
        const lineTotal = enteredQty.mul(enteredRate);

        const normalizedQty = enteredQty.mul(conversionFactor);
        const normalizedRate = lineTotal.dividedBy(normalizedQty);

        // Exact Weighted Average Cost formula using Decimal arithmetic:
        // (currentStock * currentAvgCost + normalizedQty * normalizedRate) / (currentStock + normalizedQty)
        const totalQty = currentStock.add(normalizedQty);
        const newWeightedAverageCost = totalQty.gt(0)
          ? currentStock.mul(currentAvgCost).add(lineTotal).dividedBy(totalQty)
          : normalizedRate;

        // Update inventory item balances atomically with row lock
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            currentStock: {
              increment: normalizedQty,
            },
            weightedAverageCost: newWeightedAverageCost,
          },
        });

        // Create receipt line (preserving entered UOM, quantity, and rate)
        await tx.purchaseReceiptLine.create({
          data: {
            purchaseReceiptId: receipt.id,
            inventoryItemId: item.id,
            quantity: enteredQty,
            uomId: enteredUom.id,
            unitPrice: enteredRate,
            totalPrice: lineTotal,
          },
        });

        // Record append-only stock movement in normalized base UOM
        await tx.stockMovement.create({
          data: {
            inventoryItemId: item.id,
            warehouseId: resolvedWarehouseId,
            movementType: MovementType.PURCHASE_RECEIPT,
            quantity: normalizedQty,
            unitCost: normalizedRate,
            totalCost: lineTotal,
            referenceDocumentType: "PURCHASE_RECEIPT",
            referenceDocumentId: receipt.id,
            notes: `Purchase receipt ${input.receiptNumber} from ${supplier.name}`,
          },
        });

        await adjustWarehouseOnHand(tx, {
          organizationId: resolvedOrgId,
          warehouseId: resolvedWarehouseId,
          inventoryItemId: item.id,
          delta: normalizedQty,
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
    let resolvedWarehouseId: string | undefined;
    if (warehouseId) {
      resolvedWarehouseId = await this.resolveWarehouseId(
        warehouseId,
        resolvedOrgId,
      );
    }

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
      ...(resolvedWarehouseId ? { warehouseId: resolvedWarehouseId } : {}),
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
      ...(resolvedWarehouseId ? { warehouseId: resolvedWarehouseId } : {}),
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

    // 3. When warehouseId is specified, read warehouse-level onHand from WarehouseStockBalance
    const warehouseBalanceMap = new Map<string, number>();
    if (resolvedWarehouseId) {
      const whBalances = await prisma.warehouseStockBalance.findMany({
        where: {
          organizationId: resolvedOrgId,
          warehouseId: resolvedWarehouseId,
          inventoryItemId: { in: itemIds },
        },
      });
      for (const wb of whBalances) {
        warehouseBalanceMap.set(wb.inventoryItemId, Number(wb.onHand));
      }
    }

    const balances: InventoryBalanceRow[] = [];

    for (const item of items) {
      const ledgerSum = movementMap.get(item.id) ?? 0;
      const onHand = resolvedWarehouseId
        ? (warehouseBalanceMap.get(item.id) ?? 0)
        : Number(item.currentStock);

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
   * Paginated inventory balances with server-side search, category filter, and summary totals.
   */
  async getInventoryBalancesPaginated(
    organizationId: string,
    options?: {
      warehouseId?: string;
      category?: string;
      q?: string;
      limit?: number;
      offset?: number;
      page?: number;
    },
  ) {
    const allBalances = await this.getInventoryBalances(
      organizationId,
      options?.warehouseId,
    );

    const summary = {
      totalItems: allBalances.length,
      rawMaterialCount: allBalances.filter((b) => b.category === "RAW_MATERIAL")
        .length,
      packagingCount: allBalances.filter((b) => b.category === "PACKAGING")
        .length,
      finishedGoodsCount: allBalances.filter(
        (b) => b.category === "FINISHED_GOODS",
      ).length,
      totalInventoryValue: allBalances.reduce(
        (sum, b) => sum + b.onHand * b.weightedAverageCost,
        0,
      ),
    };

    const filtered = allBalances.filter((item) => {
      if (
        options?.category &&
        options.category !== "ALL" &&
        item.category !== options.category
      ) {
        return false;
      }
      if (options?.q?.trim()) {
        const q = options.q.toLowerCase().trim();
        if (
          !item.sku.toLowerCase().includes(q) &&
          !item.name.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });

    const { items: balances, pagination } = paginateArray(filtered, options, {
      limit: 50,
      maxLimit: 100,
    });

    return { balances, summary, pagination };
  }

  /**
   * Retrieve chronological stock ledger movements for an item
   */
  async getItemLedger(
    itemId: string,
    warehouseId?: string,
    organizationId?: string,
  ) {
    if (organizationId) {
      const orgId = await this.resolveOrgId(organizationId);
      const item = await prisma.inventoryItem.findFirst({
        where: { id: itemId, organizationId: orgId },
      });
      if (!item) {
        throw new AppError(`Inventory item ${itemId} not found`, 404);
      }
    }

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
   * Paginated item ledger preserving accurate chronological running balance.
   */
  async getItemLedgerPaginated(
    itemId: string,
    options?: {
      warehouseId?: string;
      organizationId?: string;
      limit?: number;
      offset?: number;
      page?: number;
    },
  ) {
    const fullLedger = await this.getItemLedger(
      itemId,
      options?.warehouseId,
      options?.organizationId,
    );
    const { items: ledger, pagination } = paginateArray(fullLedger, options, {
      limit: 50,
      maxLimit: 100,
    });
    return { ledger, pagination };
  }

  /**
   * List purchase receipts with vendor and line details
   */
  async getPurchaseReceipts(organizationId: string) {
    const orgId = await this.resolveOrgId(organizationId);
    return await prisma.purchaseReceipt.findMany({
      where: { organizationId: orgId },
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
   * Paginated purchase receipts list with server-side search and total count.
   */
  async getPurchaseReceiptsPaginated(
    organizationId: string,
    options?: {
      q?: string;
      limit?: number;
      offset?: number;
      page?: number;
    },
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const where: Prisma.PurchaseReceiptWhereInput = { organizationId: orgId };
    if (options?.q?.trim()) {
      const q = options.q.trim();
      where.OR = [
        { receiptNumber: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
        { supplier: { code: { contains: q, mode: "insensitive" } } },
      ];
    }

    const { limit, offset } = normalizePaginationOptions(options, {
      limit: 50,
      maxLimit: 100,
    });

    const [receipts, total] = await Promise.all([
      prisma.purchaseReceipt.findMany({
        where,
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
        take: limit,
        skip: offset,
      }),
      prisma.purchaseReceipt.count({ where }),
    ]);

    return {
      receipts,
      pagination: buildPaginationMeta(limit, offset, receipts.length, total),
    };
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
   * Paginated suppliers list with server-side search, status filter, and total count.
   */
  async getSuppliersPaginated(
    organizationId: string,
    options?: {
      includeInactive?: boolean;
      status?: string;
      q?: string;
      limit?: number;
      offset?: number;
      page?: number;
    },
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const where: Prisma.SupplierWhereInput = { organizationId: orgId };
    if (options?.status === "ACTIVE") {
      where.isActive = true;
    } else if (options?.status === "INACTIVE") {
      where.isActive = false;
    } else if (!options?.includeInactive) {
      where.isActive = true;
    }

    if (options?.q?.trim()) {
      const q = options.q.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { state: { contains: q, mode: "insensitive" } },
        { gstin: { contains: q, mode: "insensitive" } },
      ];
    }

    const { limit, offset } = normalizePaginationOptions(options, {
      limit: 50,
      maxLimit: 100,
    });

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      suppliers,
      pagination: buildPaginationMeta(limit, offset, suppliers.length, total),
    };
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

        await adjustWarehouseOnHand(tx, {
          organizationId: orgId,
          warehouseId,
          inventoryItemId: created.id,
          delta: openingQty,
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
          AND "organizationId" = ${orgId}
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

      if (input.quantity < 0) {
        const whBalance = await getWarehouseItemBalance(
          tx,
          warehouseId,
          input.inventoryItemId,
        );
        const nextWhOnHand = whBalance.onHand.plus(input.quantity);
        if (nextWhOnHand.lt(0)) {
          throw new AppError(
            `Adjustment would result in negative warehouse stock (${nextWhOnHand.toString()})`,
            400,
          );
        }
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

      await adjustWarehouseOnHand(tx, {
        organizationId: orgId,
        warehouseId,
        inventoryItemId: input.inventoryItemId,
        delta: input.quantity,
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
    if (input.fromUomId === input.toUomId) {
      throw new AppError("Source and target UOM cannot be the same", 400);
    }

    const [fromUom, toUom] = await Promise.all([
      prisma.unitOfMeasure.findUnique({ where: { id: input.fromUomId } }),
      prisma.unitOfMeasure.findUnique({ where: { id: input.toUomId } }),
    ]);
    if (!fromUom || !toUom) {
      throw new AppError("Source or target UOM not found", 404);
    }

    const getDimension = (code: string): "MASS" | "VOLUME" | "COUNT" | null => {
      const c = code.toUpperCase();
      if (["KG", "G", "GM", "GRAM", "GRAMS", "MG", "TON", "QUINTAL"].includes(c)) return "MASS";
      if (["L", "LTR", "LITRE", "LITRES", "ML"].includes(c)) return "VOLUME";
      if (["PIECE", "PCS", "PACKET", "PKT", "CARTON", "CTN", "BOX", "DOZEN"].includes(c)) return "COUNT";
      return null;
    };

    const fromDim = getDimension(fromUom.code);
    const toDim = getDimension(toUom.code);
    if (fromDim && toDim && fromDim !== toDim) {
      throw new AppError(
        `Incompatible UOM dimensions: cannot convert ${fromUom.code} (${fromDim}) to ${toUom.code} (${toDim})`,
        400,
      );
    }

    const existing = await prisma.unitConversion.findUnique({
      where: {
        fromUomId_toUomId: {
          fromUomId: input.fromUomId,
          toUomId: input.toUomId,
        },
      },
    });
    if (existing) {
      throw new AppError(
        `Conversion from ${fromUom.code} to ${toUom.code} already exists`,
        409,
      );
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
          Array<{ id: string; currentStock: Prisma.Decimal; weightedAverageCost: Prisma.Decimal }>
        >`
          SELECT "id", "currentStock", "weightedAverageCost"
          FROM "inventory_item"
          WHERE "id" = ${line.inventoryItemId}
          FOR UPDATE
        `;
        if (locked.length === 0) {
          throw new AppError("Inventory item not found", 404);
        }

        const origMovement = await tx.stockMovement.findFirst({
          where: {
            referenceDocumentType: "PURCHASE_RECEIPT",
            referenceDocumentId: receipt.id,
            inventoryItemId: line.inventoryItemId,
            movementType: MovementType.PURCHASE_RECEIPT,
          },
        });

        const qty = origMovement ? Number(origMovement.quantity) : Number(line.quantity);
        const unitCostToReverse = origMovement
          ? Number(origMovement.unitCost)
          : Number(line.unitPrice);
        const currentStock = Number(locked[0].currentStock);
        const currentAvgCost = Number(locked[0].weightedAverageCost);
        const nextStock = currentStock - qty;
        if (nextStock < 0) {
          throw new AppError(
            `Cannot reverse receipt ${receipt.receiptNumber}: stock already consumed (available ${currentStock}, receipt ${qty})`,
            400,
          );
        }

        const currentTotalValue = currentStock * currentAvgCost;
        const reversedValue = Number(line.totalPrice);
        const nextAvgCost =
          nextStock > 0
            ? Math.max(0, (currentTotalValue - reversedValue) / nextStock)
            : 0;

        const mv = await tx.stockMovement.create({
          data: {
            inventoryItemId: line.inventoryItemId,
            warehouseId: receipt.warehouseId,
            movementType: "ADJUSTMENT",
            quantity: -qty,
            unitCost: unitCostToReverse,
            totalCost: Number(line.totalPrice),
            referenceDocumentType: "PURCHASE_REVERSAL",
            referenceDocumentId: receipt.id,
            notes: `Reversal of ${receipt.receiptNumber}: ${reason.trim()}`,
          },
        });
        movements.push(mv);

        await adjustWarehouseOnHand(tx, {
          organizationId: receipt.organizationId,
          warehouseId: receipt.warehouseId,
          inventoryItemId: line.inventoryItemId,
          delta: -qty,
        });

        await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: {
            currentStock: nextStock,
            weightedAverageCost: nextAvgCost,
          },
        });
      }

      await tx.purchaseReceipt.update({
        where: { id: receipt.id },
        data: { status: "REVERSED" },
      });

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

  /**
   * Inter-warehouse stock transfer (transactionally safe & idempotent).
   * Preserves org-level weighted average cost; creates traceable TRANSFER_OUT and TRANSFER_IN movements.
   */
  async postStockTransfer(
    organizationId: string,
    input: CreateStockTransferInput,
    user?: UserContext,
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new AppError(
        "Source and destination warehouses must be different",
        400,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.stockTransfer.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            fromWarehouse: true,
            toWarehouse: true,
            lines: { include: { inventoryItem: true } },
          },
        });
        if (existing) {
          return existing;
        }
      }

      const fromWh = await requireActiveOrgWarehouse(
        tx,
        orgId,
        input.fromWarehouseId,
      );
      const toWh = await requireActiveOrgWarehouse(tx, orgId, input.toWarehouseId);

      if (fromWh.id === toWh.id) {
        throw new AppError(
          "Source and destination warehouses must be different",
          400,
        );
      }

      const transferNumber = await sequenceService.getNextTransferNumber(
        tx,
        orgId,
      );

      const transfer = await tx.stockTransfer.create({
        data: {
          organizationId: orgId,
          transferNumber,
          fromWarehouseId: fromWh.id,
          toWarehouseId: toWh.id,
          status: "POSTED",
          notes: input.notes?.trim() || undefined,
          idempotencyKey: input.idempotencyKey,
          postedAt: new Date(),
        },
      });

      for (const line of input.items) {
        const lockedItem = await tx.$queryRaw<
          Array<{
            id: string;
            name: string;
            weightedAverageCost: Prisma.Decimal;
          }>
        >`
          SELECT "id", "name", "weightedAverageCost"
          FROM "inventory_item"
          WHERE "id" = ${line.inventoryItemId}
            AND "organizationId" = ${orgId}
          FOR UPDATE
        `;
        if (lockedItem.length === 0) {
          throw new AppError(
            `Inventory item ${line.inventoryItemId} not found in organization`,
            404,
          );
        }

        const item = lockedItem[0];
        const qty = new Prisma.Decimal(line.quantity);
        if (qty.lte(0)) {
          throw new AppError("Transfer quantity must be positive", 400);
        }

        // Lock source warehouse balance row if present
        await tx.$queryRaw`
          SELECT "id" FROM "warehouse_stock_balance"
          WHERE "warehouseId" = ${fromWh.id}
            AND "inventoryItemId" = ${item.id}
          FOR UPDATE
        `;

        const srcBal = await getWarehouseItemBalance(tx, fromWh.id, item.id);
        if (srcBal.available.lt(qty)) {
          throw new AppError(
            `Insufficient available stock for ${item.name} in ${fromWh.code}: available ${srcBal.available.toString()}, requested ${qty.toString()}`,
            409,
          );
        }

        const unitCost = new Prisma.Decimal(item.weightedAverageCost);
        const totalCost = qty.mul(unitCost).toDecimalPlaces(2);

        await tx.stockTransferLine.create({
          data: {
            stockTransferId: transfer.id,
            inventoryItemId: item.id,
            quantity: qty,
            unitCost,
            totalCost,
          },
        });

        await tx.stockMovement.create({
          data: {
            inventoryItemId: item.id,
            warehouseId: fromWh.id,
            movementType: MovementType.TRANSFER_OUT,
            quantity: qty.neg(),
            unitCost,
            totalCost: totalCost.neg(),
            referenceDocumentType: "STOCK_TRANSFER",
            referenceDocumentId: transfer.id,
            notes: `Transfer ${transferNumber} to ${toWh.code}`,
          },
        });

        await tx.stockMovement.create({
          data: {
            inventoryItemId: item.id,
            warehouseId: toWh.id,
            movementType: MovementType.TRANSFER_IN,
            quantity: qty,
            unitCost,
            totalCost,
            referenceDocumentType: "STOCK_TRANSFER",
            referenceDocumentId: transfer.id,
            notes: `Transfer ${transferNumber} from ${fromWh.code}`,
          },
        });

        await adjustWarehouseOnHand(tx, {
          organizationId: orgId,
          warehouseId: fromWh.id,
          inventoryItemId: item.id,
          delta: qty.neg(),
        });

        await adjustWarehouseOnHand(tx, {
          organizationId: orgId,
          warehouseId: toWh.id,
          inventoryItemId: item.id,
          delta: qty,
        });
      }

      return tx.stockTransfer.findUniqueOrThrow({
        where: { id: transfer.id },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          lines: { include: { inventoryItem: true } },
        },
      });
    });

    await auditService.log({
      organizationId: orgId,
      userId: user?.id,
      userEmail: user?.email,
      action: "TRANSFER",
      entity: "StockTransfer",
      entityId: result.id,
      details: {
        transferNumber: result.transferNumber,
        fromWarehouseId: result.fromWarehouseId,
        toWarehouseId: result.toWarehouseId,
        lineCount: result.lines.length,
      },
    });

    return result;
  }

  async getStockTransfers(organizationId: string) {
    const orgId = await this.resolveOrgId(organizationId);
    return prisma.stockTransfer.findMany({
      where: { organizationId: orgId },
      include: {
        fromWarehouse: { select: { id: true, code: true, name: true } },
        toWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            inventoryItem: {
              select: { id: true, sku: true, name: true, baseUom: true },
            },
          },
        },
      },
      orderBy: { postedAt: "desc" },
    });
  }

  async getStockTransfersPaginated(
    organizationId: string,
    options?: { limit?: number; offset?: number; page?: number },
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const where: Prisma.StockTransferWhereInput = { organizationId: orgId };
    const { limit, offset } = normalizePaginationOptions(options, {
      limit: 50,
      maxLimit: 100,
    });

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        include: {
          fromWarehouse: { select: { id: true, code: true, name: true } },
          toWarehouse: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              inventoryItem: {
                select: { id: true, sku: true, name: true, baseUom: true },
              },
            },
          },
        },
        orderBy: { postedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    return {
      transfers,
      pagination: buildPaginationMeta(limit, offset, transfers.length, total),
    };
  }

  /**
   * Reconcile warehouse stock balances against StockMovement ledger and StockReservation rows.
   */
  async getStockReconciliation(organizationId: string, warehouseId?: string) {
    const orgId = await this.resolveOrgId(organizationId);
    const resolvedWhId = warehouseId
      ? await this.resolveWarehouseId(warehouseId, orgId)
      : undefined;

    const [warehouses, items, balances, movementSums, activeReservations] =
      await Promise.all([
        prisma.warehouse.findMany({
          where: {
            organizationId: orgId,
            ...(resolvedWhId ? { id: resolvedWhId } : {}),
          },
          orderBy: { code: "asc" },
        }),
        prisma.inventoryItem.findMany({
          where: { organizationId: orgId },
          select: { id: true, sku: true, name: true, currentStock: true },
        }),
        prisma.warehouseStockBalance.findMany({
          where: {
            organizationId: orgId,
            ...(resolvedWhId ? { warehouseId: resolvedWhId } : {}),
          },
        }),
        prisma.stockMovement.groupBy({
          by: ["warehouseId", "inventoryItemId"],
          where: {
            warehouse: { organizationId: orgId },
            ...(resolvedWhId ? { warehouseId: resolvedWhId } : {}),
          },
          _sum: { quantity: true },
        }),
        prisma.stockReservation.groupBy({
          by: ["warehouseId", "inventoryItemId"],
          where: {
            warehouse: { organizationId: orgId },
            status: "ACTIVE",
            ...(resolvedWhId ? { warehouseId: resolvedWhId } : {}),
          },
          _sum: { reservedQuantity: true, releasedQuantity: true },
        }),
      ]);

    const itemMap = new Map(items.map((i) => [i.id, i]));
    const whMap = new Map(warehouses.map((w) => [w.id, w]));
    const balMap = new Map(
      balances.map((b) => [`${b.warehouseId}:${b.inventoryItemId}`, b]),
    );
    const movMap = new Map(
      movementSums.map((m) => [
        `${m.warehouseId}:${m.inventoryItemId}`,
        Number(m._sum.quantity ?? 0),
      ]),
    );
    const resMap = new Map(
      activeReservations.map((r) => [
        `${r.warehouseId}:${r.inventoryItemId}`,
        Math.max(
          0,
          Number(r._sum.reservedQuantity ?? 0) -
            Number(r._sum.releasedQuantity ?? 0),
        ),
      ]),
    );

    const keys = new Set<string>([
      ...balMap.keys(),
      ...movMap.keys(),
      ...resMap.keys(),
    ]);

    const rows: Array<{
      warehouseId: string;
      warehouseCode: string;
      inventoryItemId: string;
      sku: string;
      itemName: string;
      projectedOnHand: number;
      ledgerOnHand: number;
      onHandDiscrepancy: number;
      projectedReserved: number;
      activeReserved: number;
      reservedDiscrepancy: number;
      reconciled: boolean;
    }> = [];

    for (const key of keys) {
      const [whId, itemId] = key.split(":");
      const wh = whMap.get(whId);
      const item = itemMap.get(itemId);
      if (!wh || !item) continue;

      const bal = balMap.get(key);
      const projectedOnHand = bal ? Number(bal.onHand) : 0;
      const projectedReserved = bal ? Number(bal.reserved) : 0;
      const ledgerOnHand = movMap.get(key) ?? 0;
      const activeReserved = resMap.get(key) ?? 0;
      const onHandDiscrepancy = projectedOnHand - ledgerOnHand;
      const reservedDiscrepancy = projectedReserved - activeReserved;
      const reconciled =
        Math.abs(onHandDiscrepancy) < 0.000001 &&
        Math.abs(reservedDiscrepancy) < 0.000001;

      rows.push({
        warehouseId: wh.id,
        warehouseCode: wh.code,
        inventoryItemId: item.id,
        sku: item.sku,
        itemName: item.name,
        projectedOnHand,
        ledgerOnHand,
        onHandDiscrepancy,
        projectedReserved,
        activeReserved,
        reservedDiscrepancy,
        reconciled,
      });
    }

    return {
      reconciled: rows.every((r) => r.reconciled),
      discrepancyCount: rows.filter((r) => !r.reconciled).length,
      rows,
    };
  }
}

export const inventoryService = new InventoryService();
