import { Router } from "express";
import {
  authorize,
  getSessionOrgId,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { salesService } from "./sales.service.js";
import { dispatchService } from "./dispatch.service.js";
import { AppError } from "../../middleware/error.middleware.js";
import { prisma } from "../../db/client.js";
import {
  buildPaginationMeta,
  parsePaginationQuery,
} from "../../utils/pagination.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
  createOrderSchema,
  updateOrderSchema,
  approveOrderSchema,
  rejectOrderSchema,
  createDispatchSchema,
} from "@mill-ledger/shared";

export const salesRouter = Router();

// GET /api/v1/sales/customers - List accessible customers (Salesman assigned or Admin all)
salesRouter.get(
  "/customers",
  requireAuth,
  authorize("customer", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const { limit, offset } = parsePaginationQuery(req.query);
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const includeInactive =
        req.query.includeInactive === undefined
          ? undefined
          : req.query.includeInactive === "true";
      const result = await salesService.getCustomersPaginated(orgId, req.user!, {
        q,
        includeInactive,
        limit,
        offset,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/sales/customers - Create a customer with validated GSTIN
salesRouter.post(
  "/customers",
  requireAuth,
  authorize("customer", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = createCustomerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const customer = await salesService.createCustomer(
        parsed.data,
        req.user!,
      );
      res.status(201).json({ status: "created", customer });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/sales/salesmen - List active salesmen for assignment
salesRouter.get(
  "/salesmen",
  requireAuth,
  authorize("customer", "update"),
  async (_req: AuthenticatedRequest, res, next) => {
    try {
      const salesmen = await salesService.listSalesmen();
      res.json({ salesmen });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/sales/customers/:id - Customer detail (ABAC enforced)
salesRouter.get(
  "/customers/:id",
  requireAuth,
  authorize("customer", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const customerId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!customerId) {
        throw new AppError("Customer ID is required", 400);
      }
      const customer = await salesService.getCustomerById(customerId, req.user!);
      res.json({ customer });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/sales/customers/:id/assignments - Assign salesman
salesRouter.post(
  "/customers/:id/assignments",
  requireAuth,
  authorize("customer", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const customerId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const salesmanId = req.body?.salesmanId as string | undefined;
      if (!customerId || !salesmanId) {
        throw new AppError("Customer ID and salesmanId are required", 400);
      }
      const assignment = await salesService.assignSalesman(
        customerId,
        salesmanId,
        req.user!,
      );
      res.status(201).json({ status: "assigned", assignment });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/sales/customers/:id/assignments/:salesmanId - Unassign salesman
salesRouter.delete(
  "/customers/:id/assignments/:salesmanId",
  requireAuth,
  authorize("customer", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const customerId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const salesmanId = Array.isArray(req.params.salesmanId)
        ? req.params.salesmanId[0]
        : req.params.salesmanId;
      if (!customerId || !salesmanId) {
        throw new AppError("Customer ID and salesmanId are required", 400);
      }
      const result = await salesService.unassignSalesman(
        customerId,
        salesmanId,
        req.user!,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/sales/customers/:id - Update a customer with validated GSTIN
salesRouter.put(
  "/customers/:id",
  requireAuth,
  authorize("customer", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const customerId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!customerId) {
        throw new AppError("Customer ID is required", 400);
      }

      const parsed = updateCustomerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const customer = await salesService.updateCustomer(
        customerId,
        parsed.data,
        req.user!,
      );
      res.json({ status: "updated", customer });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/sales/customers/:id/data-export - DPDP Act Section 11 Data Subject Export
salesRouter.get(
  "/customers/:id/data-export",
  requireAuth,
  authorize("customer", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const customerId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!customerId) {
        throw new AppError("Customer ID is required", 400);
      }

      const exportData = await salesService.exportCustomerData(
        customerId,
        req.user!,
      );
      res.json({ status: "success", data: exportData });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/sales/customers/:id/anonymize - DPDP Act Section 12 Data Subject Erasure
salesRouter.post(
  "/customers/:id/anonymize",
  requireAuth,
  authorize("customer", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const customerId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!customerId) {
        throw new AppError("Customer ID is required", 400);
      }

      const { reason } = req.body || {};
      const customer = await salesService.anonymizeCustomer(
        customerId,
        req.user!,
        reason,
      );
      res.json({ status: "anonymized", customer });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/sales/products - Paginated product snapshot and price list
salesRouter.get(
  "/products",
  requireAuth,
  authorize("order", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const stock =
        typeof req.query.stock === "string" ? req.query.stock : undefined;
      const { limit, offset } = parsePaginationQuery(req.query);

      const result = await salesService.getProducts(orgId, {
        limit,
        offset,
        q,
        stock,
      });
      res.json({
        products: result.products,
        pagination: buildPaginationMeta(
          result.limit,
          result.offset,
          result.products.length,
          result.total,
        ),
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/sales/orders - List orders (ABAC enforced, paginated, batched - F-070, F-074)
salesRouter.get(
  "/orders",
  requireAuth,
  authorize("order", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const { limit, offset } = parsePaginationQuery(req.query);

      const result = await salesService.getSalesOrdersPaginated(
        orgId,
        req.user!,
        { status, q, limit, offset },
      );
      res.json(result);
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
        throw parsed.error;
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
  authorize("order", "update", async (req) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) return undefined;
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      select: { salesmanId: true, status: true },
    });
    if (!order) {
      throw new AppError(`Order ${id} not found`, 404);
    }
    return {
      creatorId: order.salesmanId,
      status: order.status,
    };
  }),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orderId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!orderId) {
        throw new AppError("Order ID is required", 400);
      }

      // Enforce server-side ownership from persistent database record, ignoring client-spoofed body
      if (req.user?.role === "SALESMAN") {
        await salesService.getSalesOrderById(orderId, req.user);
      }

      const parsed = updateOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const updated = await salesService.updateDraftOrder(
        orderId,
        parsed.data,
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
        throw parsed.error;
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
        throw parsed.error;
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

// POST /api/v1/sales/reservations/expire-stale - Sweep and expire timed-out reservations (F-027)
salesRouter.post(
  "/reservations/expire-stale",
  requireAuth,
  authorize("order", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const refTime = req.body?.referenceTime
        ? new Date(req.body.referenceTime)
        : new Date();
      const result = await salesService.expireStaleReservations(refTime);
      res.json({ status: "success", ...result });
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
        throw parsed.error;
      }

      const dispatch = await dispatchService.postDispatch(
        parsed.data,
        req.user,
      );
      res.status(201).json(dispatch);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/sales/dispatches - List dispatches (ABAC scoped per OD-03)
salesRouter.get(
  "/dispatches",
  requireAuth,
  authorize("order", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const { limit, offset } = parsePaginationQuery(req.query);
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const result = await dispatchService.getDispatchesPaginated(
        orgId,
        req.user,
        { q, status, limit, offset },
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/sales/dispatches/:id - Get single dispatch by ID (ABAC scoped per OD-03)
salesRouter.get(
  "/dispatches/:id",
  requireAuth,
  authorize("order", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const dispatchId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!dispatchId) {
        throw new AppError("Dispatch ID is required", 400);
      }
      const dispatch = await dispatchService.getDispatchById(
        dispatchId,
        req.user,
      );
      res.json({ dispatch });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/sales/returns - Record sales return against posted dispatch (IMP-014)
salesRouter.post(
  "/returns",
  requireAuth,
  authorize("order", "dispatch"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const result = await dispatchService.recordSalesReturn(
        req.body,
        req.user,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);
