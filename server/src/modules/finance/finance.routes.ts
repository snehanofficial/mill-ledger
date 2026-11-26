import { Router } from "express";
import {
  authorize,
  getSessionOrgId,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { financeService } from "./finance.service.js";
import { generateInvoicePdfBuffer } from "./invoice-pdf.util.js";
import { AppError } from "../../middleware/error.middleware.js";
import {
  createInvoiceSchema,
  creditNoteSchema,
  debitNoteSchema,
  setTaxRateSchema,
} from "@mill-ledger/shared";

export const financeRouter = Router();

// GET /api/v1/finance/invoices (paginated - F-074)
financeRouter.get(
  "/invoices",
  requireAuth,
  authorize("invoice", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const customerId = req.query.customerId as string | undefined;
      const limit =
        req.query.limit !== undefined ? Number(req.query.limit) : undefined;
      const offset =
        req.query.offset !== undefined
          ? Number(req.query.offset)
          : req.query.page && req.query.limit
            ? (Math.max(Number(req.query.page), 1) - 1) *
              Number(req.query.limit)
            : undefined;

      const invoices = await financeService.getInvoices(orgId, customerId, {
        limit,
        offset,
      });
      res.json({
        invoices,
        pagination: {
          limit: limit ?? 50,
          offset: offset ?? 0,
          count: invoices.length,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/finance/invoices/:id/pdf
financeRouter.get(
  "/invoices/:id/pdf",
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
      const pdfBuffer = await generateInvoicePdfBuffer(invoice);
      const safeFileName = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeFileName}.pdf"`,
      );
      res.send(pdfBuffer);
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
        throw parsed.error;
      }

      const invoice = await financeService.createInvoiceFromOrder(
        parsed.data,
        req.user,
      );
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
        throw parsed.error;
      }

      const creditNote = await financeService.issueCreditNote(
        invoiceId,
        parsed.data,
        req.user,
      );
      res.status(201).json(creditNote);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/finance/debit-notes - Issue supplier debit note
financeRouter.post(
  "/debit-notes",
  requireAuth,
  authorize("invoice", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = debitNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const orgId = getSessionOrgId(req);
      const debitNote = await financeService.issueDebitNote(
        {
          ...parsed.data,
          organizationId: orgId,
        },
        req.user,
      );
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
      const orgId = getSessionOrgId(req);
      const supplierId = req.query.supplierId as string | undefined;
      const debitNotes = await financeService.getDebitNotes(orgId, supplierId);
      res.json({ debitNotes });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/finance/tax-rates - List statutory tax rates
financeRouter.get(
  "/tax-rates",
  requireAuth,
  authorize("invoice", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const hsnCode = req.query.hsnCode as string | undefined;
      const taxRates = await financeService.getTaxRates(orgId, hsnCode);
      res.json({ taxRates });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/finance/tax-rates - Set statutory tax rate schedule
financeRouter.post(
  "/tax-rates",
  requireAuth,
  authorize("invoice", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = setTaxRateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }

      const orgId = getSessionOrgId(req);
      const record = await financeService.setTaxRate(orgId, parsed.data);
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  },
);
