import { Router } from "express";
import {
  authorize,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { financeService } from "./finance.service.js";
import { z } from "zod";
import { AppError } from "../../middleware/error.middleware.js";

export const financeRouter = Router();

const createInvoiceSchema = z.object({
  salesOrderId: z.string().min(1),
  notes: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  idempotencyKey: z.string().optional(),
});

const creditNoteSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
  taxableAmount: z.number().positive().optional(),
  taxAmount: z.number().positive().optional(),
  totalAmount: z.number().positive().optional(),
});

// GET /api/v1/finance/invoices
financeRouter.get(
  "/invoices",
  requireAuth,
  authorize("invoice", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = (req.query.organizationId as string) || "MILL";
      const customerId = req.query.customerId as string | undefined;
      const invoices = await financeService.getInvoices(orgId, customerId);
      res.json({ invoices });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/finance/invoices/:id
financeRouter.get(
  "/invoices/:id",
  requireAuth,
  authorize("invoice", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const invoiceId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!invoiceId) {
        throw new AppError("Invoice ID is required", 400);
      }

      const invoice = await financeService.getInvoiceById(invoiceId);
      res.json(invoice);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/finance/invoices - Create and post invoice from approved order
financeRouter.post(
  "/invoices",
  requireAuth,
  authorize("invoice", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = createInvoiceSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid invoice data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const invoice = await financeService.createInvoiceFromOrder(parsed.data);
      res.status(201).json(invoice);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/finance/invoices/:id/credit-note - Issue credit note
financeRouter.post(
  "/invoices/:id/credit-note",
  requireAuth,
  authorize("invoice", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const invoiceId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!invoiceId) {
        throw new AppError("Invoice ID is required", 400);
      }

      const parsed = creditNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid credit note data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const creditNote = await financeService.issueCreditNote(
        invoiceId,
        parsed.data,
      );
      res.status(201).json(creditNote);
    } catch (err) {
      next(err);
    }
  },
);

const debitNoteSchema = z.object({
  supplierId: z.string().min(1, "Supplier ID is required"),
  purchaseReceiptId: z.string().optional(),
  reason: z.string().min(1, "Reason is required"),
  totalAmount: z.number().positive().optional(),
  taxableAmount: z.number().positive().optional(),
  taxAmount: z.number().positive().optional(),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().optional(),
        description: z.string().optional(),
        quantity: z.number().positive().optional(),
        uomId: z.string().optional(),
        unitPrice: z.number().positive().optional(),
        taxableAmount: z.number(),
        taxAmount: z.number(),
        totalAmount: z.number().positive(),
      }),
    )
    .optional(),
});

// POST /api/v1/finance/debit-notes - Issue supplier debit note
financeRouter.post(
  "/debit-notes",
  requireAuth,
  authorize("invoice", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = debitNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid debit note data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const orgId = (req.query.organizationId as string) || "MILL";
      const debitNote = await financeService.issueDebitNote({
        ...parsed.data,
        organizationId: orgId,
      });
      res.status(201).json(debitNote);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/finance/debit-notes - List debit notes
financeRouter.get(
  "/debit-notes",
  requireAuth,
  authorize("invoice", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = (req.query.organizationId as string) || "MILL";
      const supplierId = req.query.supplierId as string | undefined;
      const debitNotes = await financeService.getDebitNotes(orgId, supplierId);
      res.json({ debitNotes });
    } catch (err) {
      next(err);
    }
  },
);
