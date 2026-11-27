import { Router } from "express";
import { buildExportFilename, type Resource } from "@mill-ledger/shared";
import {
  authorize,
  getSessionOrgId,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { AppError } from "../../middleware/error.middleware.js";
import { exportService, type ExportFormat } from "./export.service.js";

export const exportRouter = Router();

const ENTITY_RESOURCE_MAP: Record<string, Resource> = {
  products: "inventory",
  customers: "customer",
  orders: "order",
  invoices: "invoice",
  payments: "payment",
  recipes: "production_run",
  suppliers: "purchase",
};

// GET /api/v1/exports/:entity?format=pdf|xlsx|csv
exportRouter.get(
  "/:entity",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const rawEntity = Array.isArray(req.params.entity)
        ? req.params.entity[0]
        : req.params.entity;
      const entity = String(rawEntity || "").toLowerCase();
      const resource = ENTITY_RESOURCE_MAP[entity];
      if (!resource) {
        throw new AppError(`Unsupported export entity: ${entity}`, 400);
      }

      // Enforce RBAC for the target resource
      await new Promise<void>((resolve, reject) => {
        authorize(resource, "read")(req, res, (err?: unknown) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const format = String(req.query.format || "csv").toLowerCase() as ExportFormat;
      if (!["pdf", "xlsx", "csv"].includes(format)) {
        throw new AppError(`Unsupported export format: ${format}`, 400);
      }

      const idsParam = typeof req.query.ids === "string" ? req.query.ids : "";
      const ids = idsParam
        ? idsParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      const orgId = getSessionOrgId(req);
      const { content, orgName } = await exportService.exportEntity(entity, format, {
        organizationId: orgId,
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        paymentMode:
          typeof req.query.paymentMode === "string"
            ? req.query.paymentMode
            : undefined,
        startDate:
          typeof req.query.startDate === "string" && req.query.startDate
            ? new Date(req.query.startDate)
            : undefined,
        endDate:
          typeof req.query.endDate === "string" && req.query.endDate
            ? new Date(req.query.endDate)
            : undefined,
        ids,
        user: req.user!,
      });

      const filename = buildExportFilename({
        orgName,
        module: entity,
        extension: format,
      });

      if (format === "csv") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
      } else if (format === "xlsx") {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      } else {
        res.setHeader("Content-Type", "application/pdf");
      }
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(content);
    } catch (err) {
      next(err);
    }
  },
);

// Single-document PDFs
exportRouter.get(
  "/orders/:id/pdf",
  requireAuth,
  authorize("order", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const orgId = getSessionOrgId(req);
      const { buffer, orderNumber } = await exportService.generateOrderPdf(
        id,
        orgId,
        req.user!,
      );
      const filename = buildExportFilename({
        module: "",
        identifier: orderNumber,
        extension: "pdf",
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);

exportRouter.get(
  "/payments/:id/pdf",
  requireAuth,
  authorize("payment", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const orgId = getSessionOrgId(req);
      const { buffer, paymentNumber } = await exportService.generatePaymentPdf(
        id,
        orgId,
        req.user!,
      );
      const filename = buildExportFilename({
        module: "",
        identifier: paymentNumber,
        extension: "pdf",
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);

exportRouter.get(
  "/customers/:id/statement/pdf",
  requireAuth,
  authorize("customer", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const orgId = getSessionOrgId(req);
      const { buffer, customerCode } =
        await exportService.generateCustomerStatementPdf(id, orgId, req.user!);
      const filename = buildExportFilename({
        module: "Statement",
        identifier: customerCode,
        extension: "pdf",
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);

exportRouter.get(
  "/recipes/:id/pdf",
  requireAuth,
  authorize("production_run", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const orgId = getSessionOrgId(req);
      const { buffer, recipeCode } = await exportService.generateRecipePdf(
        id,
        orgId,
        req.user!,
      );
      const filename = buildExportFilename({
        module: "Recipe",
        identifier: recipeCode,
        extension: "pdf",
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);
