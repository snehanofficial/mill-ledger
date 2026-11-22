import { prisma } from "../../db/client.js";
import { OrderStatus, ReservationStatus, type Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
import type { UserContext } from "@mill-ledger/shared";

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
  status?: OrderStatus;
  lines: CreateOrderLineInput[];
}

export interface ApproveOrderLineOverride {
  lineId: string;
  approvedQuantity: number;
  approvedUnitPrice?: number;
}

export interface ApproveOrderInput {
  overrideReason?: string;
  lineOverrides?: ApproveOrderLineOverride[];
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
   * Helper to compute available stock for an inventory item in a warehouse
   * available = onHand - activeReservations
   */
  async getAvailableStock(inventoryItemId: string, warehouseId?: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });
    if (!item) return { onHand: 0, reserved: 0, available: 0 };

    const onHand = Number(item.currentStock);

    const reservationWhere: Prisma.StockReservationWhereInput = {
      inventoryItemId,
      status: ReservationStatus.ACTIVE,
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

    return await prisma.$transaction(async (tx) => {
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
      const isIntraState = customer.state.trim().toLowerCase() === "tamil nadu";

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

      for (const line of input.lines) {
        if (line.quantity <= 0) {
          throw new AppError("Line quantity must be greater than zero", 400);
        }

        const variant = await tx.productVariant.findFirst({
          where: {
            OR: [{ id: line.productVariantId }, { sku: line.productVariantId }],
          },
          include: {
            product: true,
            priceLines: {
              where: {
                priceList: { isDefault: true },
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

        // Determine unit price: explicitly provided or default price list
        let unitPrice = line.unitPrice;
        if (unitPrice === undefined || unitPrice === null) {
          const defaultPrice = variant.priceLines[0]?.price;
          unitPrice = defaultPrice ? Number(defaultPrice) : 50.0;
        }

        const taxRate = Number(variant.product.taxRate); // e.g. 5.00%
        const lineTaxable = line.quantity * unitPrice;
        const lineTax = (lineTaxable * taxRate) / 100;
        const lineTotal = lineTaxable + lineTax;

        taxableAmount += lineTaxable;
        totalTaxAmount += lineTax;

        if (isIntraState) {
          cgstAmount += lineTax / 2;
          sgstAmount += lineTax / 2;
        } else {
          igstAmount += lineTax;
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

      const totalAmount = taxableAmount + totalTaxAmount;
      const initialStatus = input.status ?? OrderStatus.SUBMITTED;

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
          taxableAmount,
          cgstAmount,
          sgstAmount,
          igstAmount,
          totalTaxAmount,
          totalAmount,
          idempotencyKey: input.idempotencyKey,
          submittedAt:
            initialStatus === OrderStatus.SUBMITTED ? new Date() : null,
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

      return {
        order: fullOrder!,
        shortages: preparedLines.map((l) => ({
          productVariantId: l.productVariantId,
          shortage: l.shortage,
        })),
      };
    });
  }

  /**
   * Review and approve sales order with atomic stock reservations
   */
  async approveSalesOrder(
    orderId: string,
    input: ApproveOrderInput,
    adminUser: UserContext,
  ) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: {
          lines: {
            include: {
              productVariant: true,
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

          // Create active Stock Reservation
          await tx.stockReservation.create({
            data: {
              salesOrderId: order.id,
              salesOrderLineId: line.id,
              inventoryItemId: line.inventoryItemId,
              warehouseId: order.warehouseId,
              reservedQuantity: approvedQty,
              status: ReservationStatus.ACTIVE,
            },
          });
        }

        const taxRate = Number(line.taxRate);
        const lineTaxable = approvedQty * approvedPrice;
        const lineTax = (lineTaxable * taxRate) / 100;
        const lineTotal = lineTaxable + lineTax;

        totalTaxable += lineTaxable;
        totalTax += lineTax;

        if (isIntraState) {
          cgstAmount += lineTax / 2;
          sgstAmount += lineTax / 2;
        } else {
          igstAmount += lineTax;
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

      if (hasOverrides && !input.overrideReason) {
        throw new AppError(
          "Admin quantity or price override requires a recorded reason",
          400,
        );
      }

      const totalAmount = totalTaxable + totalTax;

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
  }

  /**
   * Reject sales order and release any active reservations
   */
  async rejectSalesOrder(
    orderId: string,
    input: RejectOrderInput,
    _adminUser: UserContext,
  ) {
    if (!input.reason) {
      throw new AppError("Rejection reason is required", 400);
    }

    return await prisma.$transaction(async (tx) => {
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
  }

  /**
   * List orders with role-specific visibility & live shortage analysis
   */
  async getSalesOrders(
    organizationId: string,
    user: UserContext,
    status?: OrderStatus,
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
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute live shortage for each order
    const enrichedOrders = [];
    for (const order of orders) {
      let orderShortageTotal = 0;
      const linesWithShortage = [];

      for (const line of order.lines) {
        let shortage = 0;
        if (line.inventoryItemId) {
          const avail = await this.getAvailableStock(
            line.inventoryItemId,
            order.warehouseId,
          );
          // If approved, reservation already exists so available is post-reservation
          if (
            order.status === OrderStatus.SUBMITTED ||
            order.status === OrderStatus.UNDER_REVIEW
          ) {
            shortage = Math.max(
              0,
              Number(line.quotedQuantity) - avail.available,
            );
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
    input: Partial<CreateOrderInput>,
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

    if (user.role === "SALESMAN" && order.salesmanId !== user.id) {
      throw new AppError(
        "Forbidden: Cannot modify another salesman's order",
        403,
      );
    }

    return await prisma.salesOrder.update({
      where: { id: orderId },
      data: {
        notes: input.notes,
        status: input.status
          ? (String(input.status).toUpperCase() as OrderStatus)
          : order.status,
      },
      include: {
        lines: true,
      },
    });
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

    return variants.map((v) => {
      const defaultPrice = v.priceLines[0]?.price
        ? Number(v.priceLines[0].price)
        : 50.0;
      return {
        id: v.id,
        sku: v.sku,
        name: v.name,
        productName: v.product.name,
        taxRate: Number(v.product.taxRate),
        hsnCode: v.product.hsnCode,
        uom: v.uom.code,
        defaultPrice,
      };
    });
  }
}

export const salesService = new SalesService();
