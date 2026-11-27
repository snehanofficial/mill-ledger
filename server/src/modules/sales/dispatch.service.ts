import { prisma } from "../../db/client.js";
import {
  DispatchStatus,
  FulfilmentStatus,
  MovementType,
  ReservationStatus,
  type Prisma,
} from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
import { sequenceService } from "../finance/sequence.service.js";
import type { UserContext } from "@mill-ledger/shared";
import { auditService } from "../reporting/audit.service.js";
import {
  buildPaginationMeta,
  normalizePaginationOptions,
} from "../../utils/pagination.js";
import {
  adjustWarehouseOnHand,
  adjustWarehouseReserved,
  requireActiveOrgWarehouse,
} from "../inventory/warehouse-balance.helper.js";

export interface CreateDispatchLineInput {
  salesOrderLineId: string;
  quantity?: number;
}

export interface CreateDispatchInput {
  salesOrderId: string;
  warehouseId?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  notes?: string;
  idempotencyKey?: string;
  lines?: CreateDispatchLineInput[];
}

export class DispatchService {
  /**
   * Post physical dispatch for an approved sales order:
   * 1. Releases active stock reservations
   * 2. Atomically deducts finished goods inventory
   * 3. Creates append-only DISPATCH stock movement
   * 4. Updates order fulfilment status to FULFILLED
   */
  async postDispatch(input: CreateDispatchInput, user?: UserContext) {
    try {
      const result = await prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      if (input.idempotencyKey) {
        const existing = await tx.dispatch.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            lines: {
              include: { inventoryItem: true },
            },
            salesOrder: true,
            salesInvoice: true,
          },
        });
        if (existing) {
          return existing;
        }
      }

      // 2. Fetch sales order
      const order = await tx.salesOrder.findUnique({
        where: { id: input.salesOrderId },
        include: {
          lines: {
            include: {
              productVariant: true,
              reservations: {
                where: { status: ReservationStatus.ACTIVE },
              },
            },
          },
          invoices: {
            where: { status: "POSTED" },
          },
        },
      });

      if (!order) {
        throw new AppError(`Order ${input.salesOrderId} not found`, 404);
      }

      if (order.status !== "APPROVED") {
        throw new AppError(
          `Cannot dispatch order in status ${order.status}. Only APPROVED orders can be dispatched.`,
          400,
        );
      }

      const warehouseId = input.warehouseId
        ? (
            await requireActiveOrgWarehouse(
              tx,
              order.organizationId,
              input.warehouseId,
            )
          ).id
        : order.warehouseId;
      const dispatchNumber = await sequenceService.getNextDispatchNumber(
        tx,
        order.organizationId,
      );

      const linkedInvoiceId = order.invoices[0]?.id;

      // Create Dispatch header
      const dispatch = await tx.dispatch.create({
        data: {
          organizationId: order.organizationId,
          dispatchNumber,
          salesOrderId: order.id,
          salesInvoiceId: linkedInvoiceId,
          warehouseId,
          status: DispatchStatus.POSTED,
          vehicleNumber: input.vehicleNumber,
          driverName: input.driverName,
          driverPhone: input.driverPhone,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
          dispatchedAt: new Date(),
        },
      });

      let allLinesFulfilled = true;

      for (const line of order.lines) {
        const lineOverride = input.lines?.find(
          (l) => l.salesOrderLineId === line.id,
        );
        const approvedQty = Number(line.approvedQuantity);
        const alreadyDispatched = Number(line.dispatchedQuantity);
        const remainingToDispatch = approvedQty - alreadyDispatched;

        const qtyToDispatch =
          lineOverride?.quantity !== undefined
            ? lineOverride.quantity
            : remainingToDispatch;

        if (qtyToDispatch <= 0) {
          continue;
        }

        if (qtyToDispatch > remainingToDispatch) {
          throw new AppError(
            `Cannot dispatch ${qtyToDispatch}. Remaining approved quantity is ${remainingToDispatch}`,
            400,
          );
        }

        const inventoryItemId =
          line.inventoryItemId || line.productVariant.inventoryItemId;

        if (!inventoryItemId) {
          throw new AppError(
            `No inventory item linked to product variant ${line.productVariant.sku}`,
            400,
          );
        }

        const invItems = await tx.$queryRaw<
          Array<{
            id: string;
            name: string;
            sku: string;
            currentStock: unknown;
            weightedAverageCost: unknown;
          }>
        >`SELECT id, name, sku, "currentStock", "weightedAverageCost" FROM "inventory_item" WHERE id = ${inventoryItemId} FOR UPDATE`;
        const invItem = invItems[0];

        if (!invItem) {
          throw new AppError(
            `Inventory item ${inventoryItemId} not found`,
            404,
          );
        }

        const currentStock = Number(invItem.currentStock);
        if (currentStock < qtyToDispatch) {
          throw new AppError(
            `Insufficient physical on-hand stock for ${invItem.name}. Current: ${currentStock}, Dispatched: ${qtyToDispatch}`,
            400,
          );
        }

        // Release active stock reservation
        const activeRes = line.reservations[0];
        if (activeRes) {
          const releasedSoFar = Number(activeRes.releasedQuantity);
          const newReleased = releasedSoFar + qtyToDispatch;
          const isFullyReleased =
            newReleased >= Number(activeRes.reservedQuantity);

          await tx.stockReservation.update({
            where: { id: activeRes.id },
            data: {
              releasedQuantity: newReleased,
              status: isFullyReleased
                ? ReservationStatus.RELEASED
                : ReservationStatus.ACTIVE,
            },
          });

          const releaseDelta = Math.min(
            qtyToDispatch,
            Math.max(0, Number(activeRes.reservedQuantity) - releasedSoFar),
          );
          if (releaseDelta > 0) {
            await adjustWarehouseReserved(tx, {
              organizationId: order.organizationId,
              warehouseId: activeRes.warehouseId,
              inventoryItemId,
              delta: -releaseDelta,
            });
          }
        }

        // Decrement physical on-hand stock
        await tx.inventoryItem.update({
          where: { id: inventoryItemId },
          data: {
            currentStock: {
              decrement: qtyToDispatch,
            },
          },
        });

        await adjustWarehouseOnHand(tx, {
          organizationId: order.organizationId,
          warehouseId,
          inventoryItemId,
          delta: -qtyToDispatch,
        });

        // Append-only stock movement for physical dispatch deduction
        const unitCost = Number(invItem.weightedAverageCost);
        const totalCost = qtyToDispatch * unitCost;

        await tx.stockMovement.create({
          data: {
            inventoryItemId,
            warehouseId,
            movementType: MovementType.DISPATCH,
            quantity: -qtyToDispatch,
            unitCost,
            totalCost,
            referenceDocumentType: "DISPATCH",
            referenceDocumentId: dispatch.id,
            notes: `Dispatch ${dispatchNumber} for order ${order.orderNumber}`,
          },
        });

        // Create dispatch line
        await tx.dispatchLine.create({
          data: {
            dispatchId: dispatch.id,
            salesOrderLineId: line.id,
            inventoryItemId,
            quantity: qtyToDispatch,
          },
        });

        // Update sales order line dispatched quantity
        const newDispatched = alreadyDispatched + qtyToDispatch;
        await tx.salesOrderLine.update({
          where: { id: line.id },
          data: {
            dispatchedQuantity: newDispatched,
          },
        });

        if (newDispatched < approvedQty) {
          allLinesFulfilled = false;
        }
      }

      // Update sales order fulfilment status
      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          fulfilmentStatus: allLinesFulfilled
            ? FulfilmentStatus.FULFILLED
            : FulfilmentStatus.PARTIALLY_FULFILLED,
        },
      });

      return await tx.dispatch.findUnique({
        where: { id: dispatch.id },
        include: {
          lines: {
            include: { inventoryItem: true },
          },
          salesOrder: true,
          salesInvoice: true,
          warehouse: true,
        },
      });
    }, { timeout: 30000, maxWait: 10000 });

    if (result) {
      await auditService.log({
        organizationId: result.organizationId,
        userId: user?.id,
        userEmail: user?.email,
        actorName: user?.name,
        action: "DISPATCH",
        eventType: "DISPATCH_POSTED",
        entity: "Dispatch",
        entityId: result.id,
        summary: `Dispatch ${result.dispatchNumber} posted (${result.lines?.length ?? 0} line${(result.lines?.length ?? 0) === 1 ? "" : "s"})`,
        relatedEntities: [
          {
            entityType: "SalesOrder",
            entityId: result.salesOrderId,
            label: result.salesOrder?.orderNumber,
            role: "order",
          },
          ...(result.salesInvoiceId
            ? [
                {
                  entityType: "SalesInvoice",
                  entityId: result.salesInvoiceId,
                  label: result.salesInvoice?.invoiceNumber,
                  role: "invoice",
                },
              ]
            : []),
        ],
        details: {
          dispatchNumber: result.dispatchNumber,
          salesOrderId: result.salesOrderId,
          salesInvoiceId: result.salesInvoiceId,
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
        const existing = await prisma.dispatch.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            lines: {
              include: { inventoryItem: true },
            },
            salesOrder: true,
            salesInvoice: true,
            warehouse: true,
          },
        });
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  /**
   * List dispatches for an organization (with optional ABAC user-scoping per OD-03)
   */
  async getDispatches(organizationId: string, user?: UserContext) {
    const org = await prisma.organization.findFirst({
      where: { OR: [{ id: organizationId }, { code: organizationId }] },
      select: { id: true },
    });
    const resolvedOrgId = org ? org.id : organizationId;
    const where: Prisma.DispatchWhereInput = { organizationId: resolvedOrgId };

    // ABAC rule per OD-03: Salesman sees only dispatches for orders they submitted
    if (user?.role === "SALESMAN") {
      where.salesOrder = {
        salesmanId: user.id,
      };
    }

    return await prisma.dispatch.findMany({
      where,
      include: {
        lines: {
          include: { inventoryItem: true },
        },
        salesOrder: {
          include: { customer: true },
        },
        salesInvoice: true,
        warehouse: true,
      },
      orderBy: { dispatchedAt: "desc" },
    });
  }

  /**
   * Paginated dispatches list with server-side search and status filtering.
   */
  async getDispatchesPaginated(
    organizationId: string,
    user?: UserContext,
    options?: {
      q?: string;
      status?: string;
      limit?: number;
      offset?: number;
      page?: number;
    },
  ) {
    const org = await prisma.organization.findFirst({
      where: { OR: [{ id: organizationId }, { code: organizationId }] },
      select: { id: true },
    });
    const resolvedOrgId = org ? org.id : organizationId;
    const where: Prisma.DispatchWhereInput = { organizationId: resolvedOrgId };

    if (user?.role === "SALESMAN") {
      where.salesOrder = {
        salesmanId: user.id,
      };
    }

    if (options?.status && options.status !== "ALL") {
      where.status = options.status as DispatchStatus;
    }

    if (options?.q?.trim()) {
      const q = options.q.trim();
      where.OR = [
        { dispatchNumber: { contains: q, mode: "insensitive" } },
        { salesOrder: { orderNumber: { contains: q, mode: "insensitive" } } },
        {
          salesOrder: {
            customer: { name: { contains: q, mode: "insensitive" } },
          },
        },
      ];
    }

    const { limit, offset } = normalizePaginationOptions(options, {
      limit: 50,
      maxLimit: 100,
    });

    const [dispatches, total] = await Promise.all([
      prisma.dispatch.findMany({
        where,
        include: {
          lines: {
            include: { inventoryItem: true },
          },
          salesOrder: {
            include: { customer: true },
          },
          salesInvoice: true,
          warehouse: true,
        },
        orderBy: { dispatchedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.dispatch.count({ where }),
    ]);

    return {
      dispatches,
      pagination: buildPaginationMeta(limit, offset, dispatches.length, total),
    };
  }

  /**
   * Get single dispatch by ID (with ABAC user-scoping per OD-03)
   */
  async getDispatchById(dispatchId: string, user?: UserContext) {
    const where: Prisma.DispatchWhereInput = { id: dispatchId };

    // ABAC rule per OD-03: Salesman can only access dispatches for orders they submitted
    if (user?.role === "SALESMAN") {
      where.salesOrder = {
        salesmanId: user.id,
      };
    }

    const dispatch = await prisma.dispatch.findFirst({
      where,
      include: {
        lines: {
          include: { inventoryItem: true },
        },
        salesOrder: {
          include: { customer: true },
        },
        salesInvoice: true,
        warehouse: true,
      },
    });

    if (!dispatch) {
      throw new AppError("Dispatch not found", 404);
    }

    return dispatch;
  }

  /**
   * Record a sales return against a posted dispatch, restoring finished goods stock atomically (IMP-014)
   */
  async recordSalesReturn(
    input: {
      dispatchId: string;
      reason: string;
      lines: Array<{ inventoryItemId: string; quantity: number }>;
    },
    user?: UserContext,
  ) {
    if (!input.reason || input.reason.trim() === "") {
      throw new AppError("Return reason is required", 400);
    }
    if (!input.lines || input.lines.length === 0) {
      throw new AppError("At least one return line is required", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const dispatch = await tx.dispatch.findUnique({
        where: { id: input.dispatchId },
        include: { lines: true },
      });
      if (!dispatch) {
        throw new AppError(`Dispatch ${input.dispatchId} not found`, 404);
      }
      if (dispatch.status !== DispatchStatus.POSTED) {
        throw new AppError("Can only record returns against POSTED dispatches", 400);
      }

      const movements = [];
      for (const retLine of input.lines) {
        if (retLine.quantity <= 0) {
          throw new AppError("Return quantity must be greater than zero", 400);
        }
        const dispLine = dispatch.lines.find(
          (l) => l.inventoryItemId === retLine.inventoryItemId,
        );
        if (!dispLine) {
          throw new AppError(
            `Item ${retLine.inventoryItemId} was not part of dispatch ${dispatch.dispatchNumber}`,
            400,
          );
        }
        const priorReturns = await tx.stockMovement.aggregate({
          where: {
            referenceDocumentType: "SALES_RETURN",
            referenceDocumentId: dispatch.id,
            inventoryItemId: retLine.inventoryItemId,
            movementType: MovementType.RETURN,
          },
          _sum: { quantity: true },
        });
        const alreadyReturned = Number(priorReturns._sum.quantity ?? 0);
        const remainingReturnable = Number(dispLine.quantity) - alreadyReturned;

        if (retLine.quantity > remainingReturnable) {
          throw new AppError(
            `Return quantity (${retLine.quantity}) cannot exceed remaining returnable quantity (${remainingReturnable})`,
            400,
          );
        }

        const locked = await tx.$queryRaw<
          Array<{ id: string; currentStock: Prisma.Decimal; weightedAverageCost: Prisma.Decimal }>
        >`
          SELECT "id", "currentStock", "weightedAverageCost"
          FROM "inventory_item"
          WHERE "id" = ${retLine.inventoryItemId}
          FOR UPDATE
        `;
        if (locked.length === 0) {
          throw new AppError("Inventory item not found", 404);
        }

        const unitCost = Number(locked[0].weightedAverageCost);
        const nextStock = Number(locked[0].currentStock) + retLine.quantity;

        const mv = await tx.stockMovement.create({
          data: {
            inventoryItemId: retLine.inventoryItemId,
            warehouseId: dispatch.warehouseId,
            movementType: MovementType.RETURN,
            quantity: retLine.quantity,
            unitCost,
            totalCost: retLine.quantity * unitCost,
            referenceDocumentType: "SALES_RETURN",
            referenceDocumentId: dispatch.id,
            notes: `Sales return from ${dispatch.dispatchNumber}: ${input.reason.trim()}`,
          },
        });
        movements.push(mv);

        await adjustWarehouseOnHand(tx, {
          organizationId: dispatch.organizationId,
          warehouseId: dispatch.warehouseId,
          inventoryItemId: retLine.inventoryItemId,
          delta: retLine.quantity,
        });

        await tx.inventoryItem.update({
          where: { id: retLine.inventoryItemId },
          data: { currentStock: nextStock },
        });
      }

      return {
        dispatchId: dispatch.id,
        dispatchNumber: dispatch.dispatchNumber,
        organizationId: dispatch.organizationId,
        movements,
      };
    });

    await auditService.log({
      organizationId: result.organizationId,
      userId: user?.id,
      userEmail: user?.email,
      action: "SALES_RETURN",
      entity: "Dispatch",
      entityId: result.dispatchId,
      reason: input.reason.trim(),
      details: {
        dispatchNumber: result.dispatchNumber,
        lines: input.lines,
      },
    });

    return result;
  }
}

export const dispatchService = new DispatchService();
