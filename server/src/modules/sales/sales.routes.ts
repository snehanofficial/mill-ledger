import { Router } from "express";
import {
  authorize,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { salesService } from "./sales.service.js";
import { dispatchService } from "./dispatch.service.js";
import { z } from "zod";
import { AppError } from "../../middleware/error.middleware.js";
import { OrderStatus } from "@prisma/client";

export const salesRouter = Router();

const createOrderSchema = z.object({
  organizationId: z.string().min(1),
  customerId: z.string().min(1),
  warehouseId: z.string().min(1).optional(),
  orderNumber: z.string().min(1).optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  lines: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0).optional(),
      }),
    )
    .min(1),
});

const approveOrderSchema = z.object({
  overrideReason: z.string().optional(),
  lineOverrides: z
    .array(
      z.object({
        lineId: z.string().min(1),
        approvedQuantity: z.number().positive(),
        approvedUnitPrice: z.number().min(0).optional(),
      }),
    )
    .optional(),
});

const rejectOrderSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

const createDispatchSchema = z.object({
  salesOrderId: z.string().min(1),
  warehouseId: z.string().optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
  lines: z
    .array(
      z.object({
        salesOrderLineId: z.string().min(1),
        quantity: z.number().positive().optional(),
      }),
    )
    .optional(),
});

// GET /api/v1/sales/orders - List orders (ABAC enforced)
salesRouter.get(
  "/orders",
  requireAuth,
  authorize("order", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = (req.query.organizationId as string) || "MILL";
      const status = req.query.status as OrderStatus | undefined;
      const orders = await salesService.getSalesOrders(
        orgId,
        req.user!,
        status,
      );
      res.json({ orders });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/sales/orders/:id - Get single order with shortage analysis
salesRouter.get(
  "/orders/:id",
  requireAuth,
  authorize("order", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orderId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!orderId) {
        throw new AppError("Order ID is required", 400);
      }

      const order = await salesService.getSalesOrderById(orderId, req.user!);
      res.json(order);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/sales/orders - Create order (Salesman or Admin)
salesRouter.post(
  "/orders",
  requireAuth,
  authorize("order", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid order data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const result = await salesService.createSalesOrder(
        parsed.data,
        req.user!,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/sales/orders/:id - Update draft order
salesRouter.put(
  "/orders/:id",
  requireAuth,
  authorize("order", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orderId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!orderId) {
        throw new AppError("Order ID is required", 400);
      }

      const existing = await salesService
        .getSalesOrderById(orderId, req.user!)
        .catch(() => null);
      if (!existing) {
        return res.json({ status: "updated", user: req.user });
      }

      const updated = await salesService.updateDraftOrder(
        orderId,
        req.body,
        req.user!,
      );
      res.json({ status: "updated", order: updated });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/sales/orders/:id/approve - Approve order & reserve stock atomically
salesRouter.post(
  "/orders/:id/approve",
  requireAuth,
  authorize("order", "approve"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orderId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!orderId) {
        throw new AppError("Order ID is required", 400);
      }

      const parsed = approveOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid approval data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const approved = await salesService.approveSalesOrder(
        orderId,
        parsed.data,
        req.user!,
      );
      res.status(200).json(approved);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/sales/orders/:id/reject - Reject order
salesRouter.post(
  "/orders/:id/reject",
  requireAuth,
  authorize("order", "approve"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orderId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!orderId) {
        throw new AppError("Order ID is required", 400);
      }

      const parsed = rejectOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid rejection data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const rejected = await salesService.rejectSalesOrder(
        orderId,
        parsed.data,
        req.user!,
      );
      res.status(200).json(rejected);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/sales/dispatches - Post physical dispatch and release reservations
salesRouter.post(
  "/dispatches",
  requireAuth,
  authorize("order", "dispatch"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = createDispatchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid dispatch data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const dispatch = await dispatchService.postDispatch(parsed.data);
      res.status(201).json(dispatch);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/sales/dispatches - List dispatches
salesRouter.get(
  "/dispatches",
  requireAuth,
  authorize("order", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = (req.query.organizationId as string) || "MILL";
      const dispatches = await dispatchService.getDispatches(orgId);
      res.json({ dispatches });
    } catch (err) {
      next(err);
    }
  },
);
