import { prisma } from "../../db/client.js";
import { OrderStatus, ReservationStatus, Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
import type { UserContext } from "@mill-ledger/shared";
import { calculateLineTax } from "../finance/tax.util.js";
import { auditService } from "../reporting/audit.service.js";

export interface CreateOrderLineInput {
  productVariantId: string;
  quantity: number;
  unitPrice?: number;
}

export interface CreateOrderInput {
  organizationId?: string;
  customerId: string;
  warehouseId?: string;
  orderNumber?: string;
  notes?: string;
  idempotencyKey?: string;
  status?: "DRAFT" | "SUBMITTED";
  orderDate?: Date;
  pricedAt?: Date;
  lines: CreateOrderLineInput[];
}

export interface ApproveOrderLineOverride {
  lineId: string;
  approvedQuantity: number;
  approvedUnitPrice?: number;
}

export const DEFAULT_RESERVATION_TTL_HOURS = 48; // 48-hour policy window per F-027

export interface ApproveOrderInput {
  overrideReason?: string;
  lineOverrides?: ApproveOrderLineOverride[];
  reservationTtlHours?: number;
  reservationExpiresAt?: Date;
}

export interface RejectOrderInput {
  reason: string;
}

export class SalesService {
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

  /**
   * Sweeps and transitions stale active stock reservations that have exceeded their TTL.
   * Restores committed stock back to available-to-promise inventory.
   */
  async expireStaleReservations(referenceTime: Date = new Date()): Promise<{
    expiredCount: number;
    expiredReservationIds: string[];
  }> {
    return await prisma.$transaction(async (tx) => {
      const staleReservations = await tx.stockReservation.findMany({
        where: {
          status: ReservationStatus.ACTIVE,
          expiresAt: { lte: referenceTime },
        },
        select: {
          id: true,
          salesOrderId: true,
        },
      });

      if (staleReservations.length === 0) {
        return { expiredCount: 0, expiredReservationIds: [] };
      }

      const ids = staleReservations.map((r) => r.id);
      await tx.stockReservation.updateMany({
        where: { id: { in: ids } },
        data: { status: ReservationStatus.EXPIRED },
      });

      // Update notes on orders where all reservations have expired
      const orderIds = [
        ...new Set(staleReservations.map((r) => r.salesOrderId)),
      ];
      for (const orderId of orderIds) {
        const remainingActive = await tx.stockReservation.count({
          where: {
            salesOrderId: orderId,
            status: ReservationStatus.ACTIVE,
          },
        });
        if (remainingActive === 0) {
          await tx.salesOrder.update({
            where: { id: orderId },
            data: {
              notes: "Reservation expired due to exceeding policy TTL window",
            },
          });
        }
      }

      return { expiredCount: ids.length, expiredReservationIds: ids };
    });
  }

  /**
   * Helper to compute available stock for an inventory item in a warehouse
   * available = onHand - activeReservations
   */
  async getAvailableStock(
    inventoryItemId: string,
    warehouseId?: string,
    referenceTime: Date = new Date(),
  ) {
    // Automatically sweep expired reservations
    await this.expireStaleReservations(referenceTime);

    const item = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });
    if (!item) return { onHand: 0, reserved: 0, available: 0 };

    const onHand = Number(item.currentStock);

    const reservationWhere: Prisma.StockReservationWhereInput = {
      inventoryItemId,
      status: ReservationStatus.ACTIVE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: referenceTime } }],
    };
    if (warehouseId) {
      reservationWhere.warehouseId = warehouseId;
    }

    const resAgg = await prisma.stockReservation.aggregate({
      where: reservationWhere,
      _sum: {
        reservedQuantity: true,
        releasedQuantity: true,
      },
    });

    const reservedGross = Number(resAgg._sum.reservedQuantity ?? 0);
    const releasedQty = Number(resAgg._sum.releasedQuantity ?? 0);
    const reserved = Math.max(0, reservedGross - releasedQty);
    const available = Math.max(0, onHand - reserved);

    return { onHand, reserved, available };
  }

  /**
   * Create a new sales order with tax calculations and shortage analysis
   */
  async createSalesOrder(input: CreateOrderInput, user: UserContext) {
    if (!input.lines || input.lines.length === 0) {
      throw new AppError("Order must contain at least one line", 400);
    }

    try {
      const txResult = await prisma.$transaction(async (tx) => {
        // 1. Idempotency check
        if (input.idempotencyKey) {
          const existing = await tx.salesOrder.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
            include: {
              lines: {
                include: {
                  productVariant: true,
                },
              },
              customer: true,
              salesman: true,
              reservations: true,
            },
          });
          if (existing) {
            return { order: existing, shortages: [] };
          }
        }

        // 2. Validate customer and assignment
        const customer = await tx.customer.findFirst({
          where: {
            OR: [{ id: input.customerId }, { code: input.customerId }],
          },
        });
        if (!customer) {
          throw new AppError(`Customer ${input.customerId} not found`, 404);
        }

        // If actor is SALESMAN, verify assignment
        if (user.role === "SALESMAN") {
          const assignment = await tx.salesmanCustomerAssignment.findUnique({
            where: {
              salesmanId_customerId: {
                salesmanId: user.id,
                customerId: customer.id,
              },
            },
          });
          if (!assignment) {
            throw new AppError(
              `Salesman is not assigned to customer ${customer.name}`,
              403,
            );
          }
        }

        // Resolve organization ID (foreign key reference to Organization.id)
        const targetOrg =
          input.organizationId ||
          user.organizationId ||
          customer.organizationId ||
          "MILL";
        const organizationId = await this.resolveOrgId(targetOrg, tx);

        // 3. Resolve warehouse (default to first facility warehouse if not supplied)
        let warehouseId = input.warehouseId;
        if (!warehouseId) {
          const wh = await tx.warehouse.findFirst({
            where: { code: "WH-1" },
          });
          warehouseId = wh?.id;
        }
        if (!warehouseId) {
          const anyWh = await tx.warehouse.findFirst();
          warehouseId = anyWh?.id;
        }
        if (!warehouseId) {
          throw new AppError("No warehouse available for order", 400);
        }

        const orderNumber =
          input.orderNumber ??
          `SO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

        // 4. Place of supply tax calculation
        // Factory state: Tamil Nadu
        const isIntraState =
          customer.state.trim().toLowerCase() === "tamil nadu";

        let taxableAmount = 0;
        let totalTaxAmount = 0;
        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;

        const preparedLines: Array<{
          productVariantId: string;
          inventoryItemId: string | null;
          quotedQuantity: number;
          approvedQuantity: number;
          quotedUnitPrice: number;
          approvedUnitPrice: number;
          taxRate: number;
          taxableAmount: number;
          taxAmount: number;
          lineTotal: number;
          shortage: number;
        }> = [];

        let hasLineRequiringApproval = false;
        const priceMismatchReasons: string[] = [];

        for (const line of input.lines) {
          if (line.quantity <= 0) {
            throw new AppError("Line quantity must be greater than zero", 400);
          }

          const variant = await tx.productVariant.findFirst({
            where: {
              OR: [
                { id: line.productVariantId },
                { sku: line.productVariantId },
              ],
            },
            include: {
              product: true,
              priceLines: {
                where: {
                  priceList: { isDefault: true },
                },
                include: {
                  priceList: true,
                },
              },
            },
          });

          if (!variant) {
            throw new AppError(
              `Product variant ${line.productVariantId} not found`,
              404,
            );
          }

          // Determine baseline price list rate for product variant
          const activePriceLine = variant.priceLines[0];
          let basePrice = activePriceLine?.price
            ? Number(activePriceLine.price)
            : null;
          if (basePrice === null) {
            const fallbackPriceLine = await tx.priceListLine.findFirst({
              where: {
                productVariantId: variant.id,
                priceList: { organizationId },
              },
              include: {
                priceList: true,
              },
              orderBy: { createdAt: "desc" },
            });
            basePrice = fallbackPriceLine
              ? Number(fallbackPriceLine.price)
              : 50.0;
          }

          // Revalidate price freshness if order was created offline or priced earlier (F-077)
          if (input.pricedAt) {
            const pricedAtDate = new Date(input.pricedAt);
            const lineUpdated = activePriceLine?.updatedAt
              ? new Date(activePriceLine.updatedAt)
              : null;
            const listUpdated = activePriceLine?.priceList?.updatedAt
              ? new Date(activePriceLine.priceList.updatedAt)
              : null;

            const isStale =
              (lineUpdated && lineUpdated > pricedAtDate) ||
              (listUpdated && listUpdated > pricedAtDate);

            if (
              isStale &&
              line.unitPrice !== undefined &&
              line.unitPrice !== null &&
              Math.abs(Number(line.unitPrice) - basePrice) > 0.01
            ) {
              hasLineRequiringApproval = true;
              priceMismatchReasons.push(
                `Stale offline price on SKU ${variant.sku}: quoted ₹${Number(line.unitPrice).toFixed(2)} vs updated list price ₹${basePrice.toFixed(2)}`,
              );
            }
          }

          // Enforce OD-07 & REQ-024 discount threshold guard
          let unitPrice: number;
          if (line.unitPrice === undefined || line.unitPrice === null) {
            unitPrice = basePrice;
          } else {
            const baseDec = new Prisma.Decimal(basePrice);
            const requestedDec = new Prisma.Decimal(line.unitPrice);

            if (requestedDec.isNegative()) {
              throw new AppError("Unit price cannot be negative", 400);
            }

            if (requestedDec.lt(baseDec)) {
              const discountAmount = baseDec.minus(requestedDec);
              const discountPct = discountAmount.dividedBy(baseDec).times(100);

              // Discounts above 15% are rejected outright with HTTP 422
              if (discountPct.gt(15.0001)) {
                throw new AppError(
                  `DISCOUNT_EXCEEDS_MAX_THRESHOLD: Unit price ${line.unitPrice} reflects a ${discountPct.toFixed(2)}% discount, which exceeds the maximum allowable 15% threshold against list price ${basePrice}`,
                  422,
                );
              }

              // Discounts above 5% and up to 15% require Manager approval
              if (discountPct.gt(5.0001)) {
                hasLineRequiringApproval = true;
              }
            }
            unitPrice = Number(line.unitPrice);
          }

          const hsnCode = variant.product.hsnCode;
          if (!hsnCode) {
            throw new AppError(
              `TAX_CONFIGURATION_ERROR: Product ${variant.product.name} is missing an HSN code`,
              422,
            );
          }

          const effectiveDate = input.orderDate ?? new Date();
          const taxRateRecord = await tx.taxRate.findFirst({
            where: {
              organizationId,
              hsnCode,
              effectiveFrom: { lte: effectiveDate },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: effectiveDate } },
              ],
            },
            orderBy: {
              effectiveFrom: "desc",
            },
          });

          if (!taxRateRecord) {
            throw new AppError(
              `TAX_CONFIGURATION_ERROR: No active statutory GST rate found for HSN ${hsnCode}`,
              422,
            );
          }

          const taxRate = Number(taxRateRecord.rate);
          const taxRes = calculateLineTax(
            {
              quantity: line.quantity,
              unitPrice,
              taxRate,
            },
            isIntraState,
          );

          const lineTaxable = taxRes.taxableAmount.toNumber();
          const lineTax = taxRes.taxAmount.toNumber();
          const lineTotal = taxRes.lineTotal.toNumber();

          taxableAmount = Number((taxableAmount + lineTaxable).toFixed(2));
          totalTaxAmount = Number((totalTaxAmount + lineTax).toFixed(2));

          if (isIntraState) {
            cgstAmount = Number(
              (cgstAmount + taxRes.cgstAmount.toNumber()).toFixed(2),
            );
            sgstAmount = Number(
              (sgstAmount + taxRes.sgstAmount.toNumber()).toFixed(2),
            );
          } else {
            igstAmount = Number(
              (igstAmount + taxRes.igstAmount.toNumber()).toFixed(2),
            );
          }

          // Real-time stock shortage check
          let shortage = 0;
          if (variant.inventoryItemId) {
            const invItem = await tx.inventoryItem.findUnique({
              where: { id: variant.inventoryItemId },
            });
            const onHand = Number(invItem?.currentStock ?? 0);

            const resAgg = await tx.stockReservation.aggregate({
              where: {
                inventoryItemId: variant.inventoryItemId,
                warehouseId,
                status: ReservationStatus.ACTIVE,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              _sum: {
                reservedQuantity: true,
                releasedQuantity: true,
              },
            });
            const reserved = Math.max(
              0,
              Number(resAgg._sum.reservedQuantity ?? 0) -
                Number(resAgg._sum.releasedQuantity ?? 0),
            );
            const available = Math.max(0, onHand - reserved);
            shortage = Math.max(0, line.quantity - available);
          }

          preparedLines.push({
            productVariantId: variant.id,
            inventoryItemId: variant.inventoryItemId,
            quotedQuantity: line.quantity,
            approvedQuantity: line.quantity,
            quotedUnitPrice: unitPrice,
            approvedUnitPrice: unitPrice,
            taxRate,
            taxableAmount: lineTaxable,
            taxAmount: lineTax,
            lineTotal,
            shortage,
          });
        }

        const totalAmount = Number((taxableAmount + totalTaxAmount).toFixed(2));

        if (
          input.status &&
          input.status !== OrderStatus.DRAFT &&
          input.status !== OrderStatus.SUBMITTED
        ) {
          throw new AppError(
            "New sales orders can only be created with DRAFT or SUBMITTED status",
            400,
          );
        }
        let initialStatus: OrderStatus =
          input.status === OrderStatus.DRAFT
            ? OrderStatus.DRAFT
            : OrderStatus.SUBMITTED;

        // If any line has a discount between 5% and 15% or stale offline price, place order UNDER_REVIEW pending manager approval
        if (
          initialStatus === OrderStatus.SUBMITTED &&
          (hasLineRequiringApproval || priceMismatchReasons.length > 0)
        ) {
          initialStatus = OrderStatus.UNDER_REVIEW;
        }

        const overrideReason =
          priceMismatchReasons.length > 0
            ? priceMismatchReasons.join("; ")
            : undefined;

        // Create Sales Order header
        const order = await tx.salesOrder.create({
          data: {
            organizationId,
            orderNumber,
            customerId: customer.id,
            salesmanId: user.id,
            warehouseId,
            status: initialStatus,
            deliveryState: customer.state,
            notes: input.notes,
            overrideReason: overrideReason ?? null,
            taxableAmount,
            cgstAmount,
            sgstAmount,
            igstAmount,
            totalTaxAmount,
            totalAmount,
            idempotencyKey: input.idempotencyKey,
            submittedAt:
              initialStatus === OrderStatus.SUBMITTED ||
              initialStatus === OrderStatus.UNDER_REVIEW
                ? new Date()
                : null,
          },
        });

        // Create order lines
        for (const pl of preparedLines) {
          await tx.salesOrderLine.create({
            data: {
              salesOrderId: order.id,
              productVariantId: pl.productVariantId,
              inventoryItemId: pl.inventoryItemId,
              quotedQuantity: pl.quotedQuantity,
              approvedQuantity: pl.approvedQuantity,
              quotedUnitPrice: pl.quotedUnitPrice,
              approvedUnitPrice: pl.approvedUnitPrice,
              taxRate: pl.taxRate,
              taxableAmount: pl.taxableAmount,
              taxAmount: pl.taxAmount,
              lineTotal: pl.lineTotal,
            },
          });
        }

        const fullOrder = await tx.salesOrder.findUnique({
          where: { id: order.id },
          include: {
            lines: {
              include: {
                productVariant: true,
              },
            },
            customer: true,
            salesman: true,
          },
        });

        const result = {
          order: fullOrder!,
          shortages: preparedLines.map((l) => ({
            productVariantId: l.productVariantId,
            shortage: l.shortage,
          })),
        };

        return result;
      });

      await auditService.log({
        organizationId: user.organizationId ?? undefined,
        userId: user.id,
        userEmail: user.email,
        action: "CREATE",
        entity: "SalesOrder",
        entityId: txResult.order.id,
        details: {
          orderNumber: txResult.order.orderNumber,
          status: txResult.order.status,
          customerId: txResult.order.customerId,
          totalAmount: txResult.order.totalAmount,
        },
      });

      return txResult;
    } catch (err: unknown) {
      if (
        input.idempotencyKey &&
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "P2002"
      ) {
        const existing = await prisma.salesOrder.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            lines: {
              include: {
                productVariant: true,
              },
            },
            customer: true,
            salesman: true,
            reservations: true,
          },
        });
        if (existing) {
          return { order: existing, shortages: [] };
        }
      }
      throw err;
    }
  }

  /**
   * Review and approve sales order with atomic stock reservations
   */
  async approveSalesOrder(
    orderId: string,
    input: ApproveOrderInput,
    adminUser: UserContext,
  ) {
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: {
          lines: {
            include: {
              productVariant: {
                include: {
                  priceLines: {
                    where: { priceList: { isDefault: true } },
                  },
                },
              },
            },
          },
          customer: true,
        },
      });

      if (!order) {
        throw new AppError(`Order ${orderId} not found`, 404);
      }

      if (
        order.status !== OrderStatus.SUBMITTED &&
        order.status !== OrderStatus.UNDER_REVIEW
      ) {
        throw new AppError(
          `Cannot approve order in status ${order.status}. Only SUBMITTED or UNDER_REVIEW orders can be approved.`,
          400,
        );
      }

      const isIntraState =
        order.deliveryState.trim().toLowerCase() === "tamil nadu";
      let totalTaxable = 0;
      let totalTax = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      // Track whether admin changed price or quantity
      let hasOverrides = false;

      // Acquire row-level locks on all involved inventory items in deterministic order (prevents concurrent overselling & deadlocks - F-007)
      const involvedItemIds = [
        ...new Set(
          order.lines
            .map((l) => l.inventoryItemId)
            .filter((id): id is string => Boolean(id)),
        ),
      ].sort();

      const lockedItems = new Map<string, number>();
      for (const itemId of involvedItemIds) {
        const rows = await tx.$queryRaw<
          Array<{ id: string; currentStock: unknown }>
        >`SELECT id, "currentStock" FROM "inventory_item" WHERE id = ${itemId} FOR UPDATE`;
        if (rows[0]) {
          lockedItems.set(itemId, Number(rows[0].currentStock));
        }
      }

      for (const line of order.lines) {
        const override = input.lineOverrides?.find((o) => o.lineId === line.id);
        const approvedQty = override
          ? override.approvedQuantity
          : Number(line.quotedQuantity);
        const approvedPrice =
          override?.approvedUnitPrice !== undefined
            ? override.approvedUnitPrice
            : Number(line.quotedUnitPrice);

        if (override?.approvedUnitPrice !== undefined) {
          const overridePriceDec = new Prisma.Decimal(
            override.approvedUnitPrice,
          );
          if (overridePriceDec.isNegative()) {
            throw new AppError("Approved unit price cannot be negative", 400);
          }
          const defaultPrice = line.productVariant.priceLines?.[0]?.price;
          const basePrice = defaultPrice ? Number(defaultPrice) : 50.0;
          const baseDec = new Prisma.Decimal(basePrice);
          if (overridePriceDec.lt(baseDec)) {
            const discountPct = baseDec
              .minus(overridePriceDec)
              .dividedBy(baseDec)
              .times(100);
            if (discountPct.gt(15.0001)) {
              throw new AppError(
                `DISCOUNT_EXCEEDS_MAX_THRESHOLD: Approved unit price ${override.approvedUnitPrice} reflects a ${discountPct.toFixed(2)}% discount, which exceeds the maximum allowable 15% threshold against list price ${basePrice}`,
                422,
              );
            }
          }
        }

        if (
          approvedQty !== Number(line.quotedQuantity) ||
          approvedPrice !== Number(line.quotedUnitPrice)
        ) {
          hasOverrides = true;
        }

        if (approvedQty <= 0) {
          throw new AppError(
            "Approved quantity must be greater than zero",
            400,
          );
        }

        // Verify stock availability
        if (line.inventoryItemId) {
          const onHand = lockedItems.get(line.inventoryItemId) ?? 0;

          const resAgg = await tx.stockReservation.aggregate({
            where: {
              inventoryItemId: line.inventoryItemId,
              warehouseId: order.warehouseId,
              status: ReservationStatus.ACTIVE,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            _sum: {
              reservedQuantity: true,
              releasedQuantity: true,
            },
          });
          const reserved = Math.max(
            0,
            Number(resAgg._sum.reservedQuantity ?? 0) -
              Number(resAgg._sum.releasedQuantity ?? 0),
          );
          const available = Math.max(0, onHand - reserved);

          if (available < approvedQty) {
            const shortage = approvedQty - available;
            throw new AppError(
              `Insufficient stock to approve order ${order.orderNumber}. Available: ${available}, Approved: ${approvedQty}, Shortage: ${shortage}`,
              400,
            );
          }

          const expiresAt =
            input.reservationExpiresAt !== undefined
              ? input.reservationExpiresAt
              : new Date(
                  Date.now() +
                    (input.reservationTtlHours ??
                      DEFAULT_RESERVATION_TTL_HOURS) *
                      60 *
                      60 *
                      1000,
                );

          // Create active Stock Reservation with TTL policy (F-027)
          await tx.stockReservation.create({
            data: {
              salesOrderId: order.id,
              salesOrderLineId: line.id,
              inventoryItemId: line.inventoryItemId,
              warehouseId: order.warehouseId,
              reservedQuantity: approvedQty,
              status: ReservationStatus.ACTIVE,
              expiresAt,
            },
          });
        }

        const taxRate = Number(line.taxRate);
        const taxRes = calculateLineTax(
          {
            quantity: approvedQty,
            unitPrice: approvedPrice,
            taxRate,
          },
          isIntraState,
        );

        const lineTaxable = taxRes.taxableAmount.toNumber();
        const lineTax = taxRes.taxAmount.toNumber();
        const lineTotal = taxRes.lineTotal.toNumber();

        totalTaxable = Number((totalTaxable + lineTaxable).toFixed(2));
        totalTax = Number((totalTax + lineTax).toFixed(2));

        if (isIntraState) {
          cgstAmount = Number(
            (cgstAmount + taxRes.cgstAmount.toNumber()).toFixed(2),
          );
          sgstAmount = Number(
            (sgstAmount + taxRes.sgstAmount.toNumber()).toFixed(2),
          );
        } else {
          igstAmount = Number(
            (igstAmount + taxRes.igstAmount.toNumber()).toFixed(2),
          );
        }

        // Update line with approved values
        await tx.salesOrderLine.update({
          where: { id: line.id },
          data: {
            approvedQuantity: approvedQty,
            approvedUnitPrice: approvedPrice,
            taxableAmount: lineTaxable,
            taxAmount: lineTax,
            lineTotal,
          },
        });
      }

      const requiresReason =
        hasOverrides || order.status === OrderStatus.UNDER_REVIEW;
      if (requiresReason && !input.overrideReason) {
        throw new AppError(
          "Manager approval for price discount or override requires a recorded reason",
          400,
        );
      }

      const totalAmount = Number((totalTaxable + totalTax).toFixed(2));

      const updatedOrder = await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.APPROVED,
          approvedAt: new Date(),
          approvedByUserId: adminUser.id,
          overrideReason: input.overrideReason,
          taxableAmount: totalTaxable,
          cgstAmount,
          sgstAmount,
          igstAmount,
          totalTaxAmount: totalTax,
          totalAmount,
        },
        include: {
          lines: {
            include: {
              productVariant: true,
            },
          },
          reservations: true,
          customer: true,
          salesman: true,
        },
      });

      return updatedOrder;
    });

    await auditService.log({
      organizationId: adminUser.organizationId ?? undefined,
      userId: adminUser.id,
      userEmail: adminUser.email,
      action: "APPROVE",
      entity: "SalesOrder",
      entityId: updatedOrder.id,
      details: {
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        totalAmount: updatedOrder.totalAmount,
      },
    });

    return updatedOrder;
  }

  /**
   * Reject sales order and release any active reservations
   */
  async rejectSalesOrder(
    orderId: string,
    input: RejectOrderInput,
    adminUser: UserContext,
  ) {
    if (!input.reason) {
      throw new AppError("Rejection reason is required", 400);
    }

    const rejected = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new AppError(`Order ${orderId} not found`, 404);
      }

      if (
        order.status === OrderStatus.CLOSED ||
        order.status === OrderStatus.REJECTED
      ) {
        throw new AppError(`Order is already ${order.status}`, 400);
      }

      // Cancel any active reservations
      await tx.stockReservation.updateMany({
        where: {
          salesOrderId: order.id,
          status: ReservationStatus.ACTIVE,
        },
        data: {
          status: ReservationStatus.CANCELLED,
        },
      });

      return await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REJECTED,
          rejectionReason: input.reason,
          rejectedAt: new Date(),
        },
        include: {
          lines: true,
          customer: true,
          salesman: true,
        },
      });
    });

    await auditService.log({
      organizationId: adminUser.organizationId ?? undefined,
      userId: adminUser.id,
      userEmail: adminUser.email,
      action: "REJECT",
      entity: "SalesOrder",
      entityId: rejected.id,
      reason: input.reason,
      details: {
        orderNumber: rejected.orderNumber,
        status: rejected.status,
      },
    });

    return rejected;
  }

  /**
   * List orders with role-specific visibility & live shortage analysis (F-070 / F-074)
   * Enforces bounded pagination (default 50, max 100) and replaces N+1 queries with batched resolution.
   */
  async getSalesOrders(
    organizationId: string,
    user: UserContext,
    status?: OrderStatus,
    options?: { limit?: number; offset?: number },
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const where: Prisma.SalesOrderWhereInput = {
      organizationId: orgId,
    };

    if (status) {
      where.status = status;
    }

    // ABAC rule: salesman sees only their own orders
    if (user.role === "SALESMAN") {
      where.salesmanId = user.id;
    }

    const limit =
      options?.limit !== undefined
        ? Math.min(Math.max(Number(options.limit) || 50, 1), 100)
        : 50;
    const offset =
      options?.offset !== undefined
        ? Math.max(Number(options.offset) || 0, 0)
        : undefined;

    const orders = await prisma.salesOrder.findMany({
      where,
      include: {
        lines: {
          include: {
            productVariant: true,
          },
        },
        customer: true,
        salesman: true,
        reservations: true,
        invoices: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const refTime = new Date();
    await this.expireStaleReservations(refTime);

    // Collect all unique inventory item IDs across all orders and lines
    const allItemIds = Array.from(
      new Set(
        orders.flatMap((o) =>
          o.lines
            .map((l) => l.inventoryItemId)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    );

    const onHandMap = new Map<string, number>();
    const reservedMap = new Map<string, number>();

    if (allItemIds.length > 0) {
      const items = await prisma.inventoryItem.findMany({
        where: { id: { in: allItemIds } },
        select: { id: true, currentStock: true },
      });
      for (const item of items) {
        onHandMap.set(item.id, Number(item.currentStock));
      }

      const activeReservations = await prisma.stockReservation.groupBy({
        by: ["inventoryItemId", "warehouseId"],
        where: {
          inventoryItemId: { in: allItemIds },
          status: ReservationStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: refTime } }],
        },
        _sum: {
          reservedQuantity: true,
          releasedQuantity: true,
        },
      });

      for (const res of activeReservations) {
        const net = Math.max(
          0,
          Number(res._sum.reservedQuantity ?? 0) -
            Number(res._sum.releasedQuantity ?? 0),
        );
        const keyWithWh = `${res.inventoryItemId}:${res.warehouseId}`;
        reservedMap.set(keyWithWh, (reservedMap.get(keyWithWh) ?? 0) + net);
        const keyAll = `${res.inventoryItemId}:ALL`;
        reservedMap.set(keyAll, (reservedMap.get(keyAll) ?? 0) + net);
      }
    }

    // Compute live shortage for each order in memory (O(1) lookup per line)
    const enrichedOrders = [];
    for (const order of orders) {
      let orderShortageTotal = 0;
      const linesWithShortage = [];

      for (const line of order.lines) {
        let shortage = 0;
        if (line.inventoryItemId) {
          const onHand = onHandMap.get(line.inventoryItemId) ?? 0;
          const reservedKey = order.warehouseId
            ? `${line.inventoryItemId}:${order.warehouseId}`
            : `${line.inventoryItemId}:ALL`;
          const reserved = reservedMap.get(reservedKey) ?? 0;
          const available = Math.max(0, onHand - reserved);

          // If approved, reservation already exists so available is post-reservation
          if (
            order.status === OrderStatus.SUBMITTED ||
            order.status === OrderStatus.UNDER_REVIEW
          ) {
            shortage = Math.max(0, Number(line.quotedQuantity) - available);
          }
        }
        orderShortageTotal += shortage;
        linesWithShortage.push({
          ...line,
          liveShortage: shortage,
        });
      }

      enrichedOrders.push({
        ...order,
        lines: linesWithShortage,
        totalShortage: orderShortageTotal,
      });
    }

    return enrichedOrders;
  }

  /**
   * Get single order by ID with ABAC authorization
   */
  async getSalesOrderById(orderId: string, user: UserContext) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            productVariant: true,
          },
        },
        customer: true,
        salesman: true,
        reservations: true,
        invoices: true,
      },
    });

    if (!order) {
      throw new AppError(`Order ${orderId} not found`, 404);
    }

    // ABAC check: salesman cannot read other salesmen's orders
    if (user.role === "SALESMAN" && order.salesmanId !== user.id) {
      throw new AppError(
        "Forbidden: Cannot view orders belonging to another salesman",
        403,
      );
    }

    // Live shortage computation
    const linesWithShortage = [];
    let totalShortage = 0;
    for (const line of order.lines) {
      let shortage = 0;
      if (line.inventoryItemId) {
        const avail = await this.getAvailableStock(
          line.inventoryItemId,
          order.warehouseId,
        );
        if (
          order.status === OrderStatus.SUBMITTED ||
          order.status === OrderStatus.UNDER_REVIEW
        ) {
          shortage = Math.max(0, Number(line.quotedQuantity) - avail.available);
        }
      }
      totalShortage += shortage;
      linesWithShortage.push({
        ...line,
        liveShortage: shortage,
      });
    }

    return {
      ...order,
      lines: linesWithShortage,
      totalShortage,
    };
  }

  /**
   * Update draft order
   */
  async updateDraftOrder(
    orderId: string,
    input: Omit<Partial<CreateOrderInput>, "notes"> & { notes?: string | null },
    user: UserContext,
  ) {
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new AppError(`Order ${orderId} not found`, 404);
    }

    if (order.status !== OrderStatus.DRAFT) {
      throw new AppError("Only DRAFT orders can be updated", 400);
    }

    if (
      input.status &&
      input.status !== OrderStatus.DRAFT &&
      input.status !== OrderStatus.SUBMITTED
    ) {
      throw new AppError(
        "Draft orders can only be updated to DRAFT or SUBMITTED status",
        400,
      );
    }

    if (user.role === "SALESMAN" && order.salesmanId !== user.id) {
      throw new AppError(
        "Forbidden: Cannot modify another salesman's order",
        403,
      );
    }

    const updated = await prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        notes: input.notes !== undefined ? (input.notes ?? null) : undefined,
        status: input.status
          ? (String(input.status).toUpperCase() as OrderStatus)
          : order.status,
      },
      include: {
        lines: true,
      },
    });

    await auditService.log({
      organizationId: user.organizationId ?? undefined,
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      entity: "SalesOrder",
      entityId: updated.id,
      details: {
        orderNumber: updated.orderNumber,
        status: updated.status,
        notes: updated.notes,
      },
    });

    return updated;
  }

  /**
   * Get customers accessible by user (ABAC: salesman gets assigned customers only)
   */
  async getCustomers(organizationId: string, user: UserContext) {
    const org = await this.resolveOrgId(organizationId);
    if (user.role === "SALESMAN") {
      const assignments = await prisma.salesmanCustomerAssignment.findMany({
        where: { salesmanId: user.id },
        include: {
          customer: true,
        },
      });
      return assignments.map((a) => a.customer);
    }

    return await prisma.customer.findMany({
      where: { organizationId: org },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Create customer with validated GSTIN
   */
  async createCustomer(
    data: {
      organizationId?: string;
      code: string;
      name: string;
      phone?: string | null;
      email?: string | null;
      state?: string;
      gstin?: string | null;
      isActive?: boolean;
    },
    user: UserContext,
  ) {
    const orgId = await this.resolveOrgId(data.organizationId);
    const customer = await prisma.customer.create({
      data: {
        organizationId: orgId,
        code: data.code,
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        state: data.state || "Tamil Nadu",
        gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
        isActive: data.isActive ?? true,
      },
    });

    await auditService.log({
      organizationId: orgId,
      userId: user.id,
      userEmail: user.email,
      action: "CREATE",
      entity: "Customer",
      entityId: customer.id,
      details: {
        code: customer.code,
        name: customer.name,
        gstin: customer.gstin,
      },
    });

    return customer;
  }

  /**
   * Update customer with validated GSTIN
   */
  async updateCustomer(
    id: string,
    data: {
      name?: string;
      phone?: string | null;
      email?: string | null;
      state?: string;
      gstin?: string | null;
      isActive?: boolean;
    },
    user: UserContext,
  ) {
    const customer = await prisma.customer.findUnique({
      where: { id },
    });
    if (!customer) {
      throw new AppError(`Customer ${id} not found`, 404);
    }
    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        phone: data.phone !== undefined ? data.phone : undefined,
        email: data.email !== undefined ? data.email : undefined,
        state: data.state !== undefined ? data.state : undefined,
        gstin:
          data.gstin !== undefined
            ? data.gstin
              ? data.gstin.trim().toUpperCase()
              : null
            : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
    });

    await auditService.log({
      organizationId: customer.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      entity: "Customer",
      entityId: updated.id,
      details: {
        name: updated.name,
        gstin: updated.gstin,
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  /**
   * Get sellable products and default price list snapshot for offline cache
   */
  async getProducts(organizationId: string) {
    const org = await this.resolveOrgId(organizationId);
    const variants = await prisma.productVariant.findMany({
      where: {
        product: {
          organizationId: org,
          isActive: true,
        },
      },
      include: {
        product: true,
        uom: true,
        priceLines: {
          where: {
            priceList: {
              isDefault: true,
            },
          },
        },
      },
      orderBy: {
        sku: "asc",
      },
    });

    const now = new Date();
    const hsnCodes = Array.from(
      new Set(
        variants
          .map((v) => v.product.hsnCode)
          .filter((h): h is string => Boolean(h)),
      ),
    );
    const taxRates = await prisma.taxRate.findMany({
      where: {
        organizationId,
        hsnCode: { in: hsnCodes },
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
      },
      orderBy: {
        effectiveFrom: "desc",
      },
    });

    const taxRateMap = new Map<string, number>();
    for (const tr of taxRates) {
      if (!taxRateMap.has(tr.hsnCode)) {
        taxRateMap.set(tr.hsnCode, Number(tr.rate));
      }
    }

    return variants.map((v) => {
      const defaultPrice = v.priceLines[0]?.price
        ? Number(v.priceLines[0].price)
        : 50.0;
      const dynamicRate = v.product.hsnCode
        ? taxRateMap.get(v.product.hsnCode)
        : undefined;
      return {
        id: v.id,
        sku: v.sku,
        name: v.name,
        productName: v.product.name,
        taxRate:
          dynamicRate !== undefined ? dynamicRate : Number(v.product.taxRate),
        hsnCode: v.product.hsnCode,
        uom: v.uom.code,
        defaultPrice,
        imageUrl: v.imageUrl || "/products/default.svg",
        thumbnailUrl: v.thumbnailUrl || "/products/default.svg",
        thumbHash: v.thumbHash,
      };
    });
  }

  /**
   * Export Customer Data (DPDP Act 2023 Section 11 - Right to Access)
   */
  async exportCustomerData(customerId: string, user: UserContext) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        salesOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
            outstandingAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        payments: {
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            paymentMode: true,
            paymentDate: true,
          },
          orderBy: { paymentDate: "desc" },
        },
      },
    });

    if (!customer) {
      throw new AppError("Customer not found", 404);
    }

    // Verify ABAC access
    if (user.role === "SALESMAN") {
      const isAssigned = await prisma.salesmanCustomerAssignment.findFirst({
        where: {
          salesmanId: user.id,
          customerId,
        },
      });
      if (!isAssigned) {
        throw new AppError(
          "Access denied: Customer is not assigned to you",
          403,
        );
      }
    }

    await auditService.log({
      organizationId: customer.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: "EXPORT",
      entity: "Customer",
      entityId: customer.id,
      details: { exportType: "DPDP_DATA_ACCESS", customerCode: customer.code },
    });

    return {
      exportedAt: new Date().toISOString(),
      statutoryReference: "DPDP Act 2023 Section 11",
      profile: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        state: customer.state,
        gstin: customer.gstin,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      documentSummary: {
        ordersCount: customer.salesOrders.length,
        invoicesCount: customer.invoices.length,
        paymentsCount: customer.payments.length,
        salesOrders: customer.salesOrders,
        salesInvoices: customer.invoices,
        payments: customer.payments,
      },
    };
  }

  /**
   * Anonymize Customer PII (DPDP Act 2023 Section 12 - Right to Erasure)
   * Redacts personal identifiers without breaking historical accounting records (CGST Section 36).
   */
  async anonymizeCustomer(
    customerId: string,
    user: UserContext,
    reason?: string,
  ) {
    if (user.role !== "ADMIN" && user.role !== "OWNER") {
      throw new AppError(
        "Only administrators and owners can anonymize customer data under DPDP Act",
        403,
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new AppError("Customer not found", 404);
    }

    const previousCode = customer.code;

    const [anonymized] = await prisma.$transaction([
      prisma.customer.update({
        where: { id: customerId },
        data: {
          name: "ANONYMIZED_CUSTOMER",
          phone: null,
          email: null,
          gstin: null,
          isActive: false,
        },
      }),
      prisma.salesmanCustomerAssignment.deleteMany({
        where: { customerId },
      }),
    ]);

    await auditService.log({
      organizationId: customer.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: "ANONYMIZE",
      entity: "Customer",
      entityId: customer.id,
      details: {
        previousCode,
        reason:
          reason || "Data Subject Erasure Request (DPDP Act 2023 Section 12)",
      },
    });

    return anonymized;
  }
}

export const salesService = new SalesService();
