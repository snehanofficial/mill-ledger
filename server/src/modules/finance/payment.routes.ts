import { Router } from "express";
import {
  authorize,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { paymentService } from "./payment.service.js";
import { AppError } from "../../middleware/error.middleware.js";
import { recordPaymentSchema, bouncePaymentSchema } from "@mill-ledger/shared";

export const paymentRouter = Router();

// GET /api/v1/payments - List payments
paymentRouter.get(
  "/",
  requireAuth,
  authorize("payment", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = (req.query.organizationId as string) || "MILL";
      const customerId = req.query.customerId as string | undefined;
      const payments = await paymentService.getPayments(orgId, customerId);
      res.json({ payments });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/payments/receivables/summary - Receivables summary
paymentRouter.get(
  "/receivables/summary",
  requireAuth,
  authorize("payment", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = (req.query.organizationId as string) || "MILL";
      const summary = await paymentService.getReceivablesSummary(orgId);
      res.json({ receivables: summary });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/payments/ledger/:customerId - Customer ledger and ageing
paymentRouter.get(
  "/ledger/:customerId",
  requireAuth,
  authorize("payment", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const customerId = Array.isArray(req.params.customerId)
        ? req.params.customerId[0]
        : req.params.customerId;
      if (!customerId) {
        throw new AppError("Customer ID is required", 400);
      }
      const orgId = (req.query.organizationId as string) || "MILL";
      const ledger = await paymentService.getCustomerLedger(orgId, customerId);
      res.json(ledger);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/payments/:id - Get payment details
paymentRouter.get(
  "/:id",
  requireAuth,
  authorize("payment", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const paymentId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!paymentId) {
        throw new AppError("Payment ID is required", 400);
      }
      const payment = await paymentService.getPaymentById(paymentId);
      res.json(payment);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/payments - Record receipt and allocations
paymentRouter.post(
  "/",
  requireAuth,
  authorize("payment", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = recordPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const orgId = (req.query.organizationId as string) || "MILL";
      const payment = await paymentService.recordPayment(
        {
          ...parsed.data,
          organizationId: orgId,
        },
        req.user,
      );

      res.status(201).json(payment);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/payments/:id/bounce - Bounce payment and restore allocations
paymentRouter.post(
  "/:id/bounce",
  requireAuth,
  authorize("payment", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const paymentId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!paymentId) {
        throw new AppError("Payment ID is required", 400);
      }

      const parsed = bouncePaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const payment = await paymentService.bouncePayment(
        paymentId,
        parsed.data,
        req.user,
      );
      res.json(payment);
    } catch (err) {
      next(err);
    }
  },
);
