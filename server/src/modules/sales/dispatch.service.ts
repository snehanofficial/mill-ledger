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

      const warehouseId = input.warehouseId || order.warehouseId;
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
    });

    if (result) {
      await auditService.log({
        organizationId: result.organizationId,
        userId: user?.id,
        userEmail: user?.email,
        action: "DISPATCH",
        entity: "Dispatch",
        entityId: result.id,
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
    const where: Prisma.DispatchWhereInput = { organizationId };

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
}

export const dispatchService = new DispatchService();
