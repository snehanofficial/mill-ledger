import { Router } from "express";
import {
  authorize,
  getSessionOrgId,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { reportingService } from "./reporting.service.js";
import { auditService } from "./audit.service.js";
import { AppError } from "../../middleware/error.middleware.js";
import { paginateArray, parsePaginationQuery } from "../../utils/pagination.js";

export const reportingRouter = Router();

// GET /api/v1/reports/dashboard or /api/v1/dashboard - Executive overview
reportingRouter.get(
  ["/", "/dashboard"],
  requireAuth,
  authorize("report", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const dashboard = await reportingService.getOwnerDashboard({
        organizationId: orgId,
      });
      res.json(dashboard);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/reports/audit - Audit log report
reportingRouter.get(
  "/audit",
  requireAuth,
  authorize("report", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const role = req.user?.role;
      if (role !== "ADMIN" && role !== "OWNER" && role !== "ACCOUNTANT") {
        throw new AppError(
          "Only administrators, accountants, and owners can view audit logs",
          403,
        );
      }

      const orgId = getSessionOrgId(req);
      const entity = req.query.entity as string | undefined;
      const action = req.query.action as string | undefined;
      const { limit, offset } = parsePaginationQuery(req.query, {
        limit: 50,
        maxLimit: 100,
      });

      const { logs, pagination } = await auditService.getLogsPaginated({
        organizationId: orgId,
        entity,
        action,
        limit,
        offset,
      });

      res.json({
        reportTitle: "System Audit Log",
        generatedAt: new Date(),
        logs,
        pagination,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Export report handler supporting GET /:report/export and POST /export or /exports
const handleReportExport = async (
  req: AuthenticatedRequest,
  res: any,
  next: any,
) => {
  try {
    const reportParam =
      req.params.report || req.body?.reportType || req.query.reportType;
    const reportType = String(
      Array.isArray(reportParam) ? reportParam[0] : reportParam || "",
    ).toLowerCase();
    const role = req.user?.role;

    // Scoping rules
    if (
      role === "SALESMAN" &&
      ["purchase", "production", "gst", "audit"].includes(reportType)
    ) {
      throw new AppError(
        "Salesman scope cannot access this report export",
        403,
      );
    }
    if (
      role === "PRODUCTION" &&
      [
        "sales",
        "customer-sales",
        "product-sales",
        "gst",
        "receivables",
        "collections",
        "audit",
      ].includes(reportType)
    ) {
      throw new AppError(
        "Production scope cannot access this report export",
        403,
      );
    }

    const orgId = getSessionOrgId(req);
    const format = String(
      req.query.format || req.body?.format || "csv",
    ).toLowerCase();

    const startDateRaw = req.query.startDate || req.body?.startDate;
    const endDateRaw = req.query.endDate || req.body?.endDate;

    const params = {
      organizationId: orgId,
      startDate: startDateRaw ? new Date(startDateRaw as string) : undefined,
      endDate: endDateRaw ? new Date(endDateRaw as string) : undefined,
      customerId:
        (req.query.customerId as string | undefined) ||
        (req.body?.customerId as string | undefined),
      salesmanId:
        role === "SALESMAN"
          ? req.user!.id
          : ((req.query.salesmanId || req.body?.salesmanId) as
              | string
              | undefined),
      supplierId:
        (req.query.supplierId as string | undefined) ||
        (req.body?.supplierId as string | undefined),
      recipeId:
        (req.query.recipeId as string | undefined) ||
        (req.body?.recipeId as string | undefined),
    };

    if (format === "csv") {
      const csvContent = await reportingService.exportToCSV(
        reportType,
        params,
        req.user,
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      return res.send(csvContent);
    } else if (format === "xlsx") {
      const xlsxBuffer = await reportingService.exportToXLSX(
        reportType,
        params,
        req.user,
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportType}-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      );
      return res.send(xlsxBuffer);
    } else if (format === "pdf") {
      const pdfBuffer = await reportingService.exportToPDF(
        reportType,
        params,
        req.user,
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportType}-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
      );
      return res.send(pdfBuffer);
    } else {
      // JSON export
      let data: unknown;
      switch (reportType) {
        case "sales":
          data = await reportingService.getSalesReport(params);
          break;
        case "customer-sales":
          data = await reportingService.getCustomerWiseSalesReport(params);
          break;
        case "product-sales":
          data = await reportingService.getProductWiseSalesReport(params);
          break;
        case "stock-ledger":
          data = await reportingService.getStockLedgerReport(params);
          break;
        case "gst":
          data = await reportingService.getGSTOutwardSummary(params);
          break;
        case "purchase":
          data = await reportingService.getPurchaseReport(params);
          break;
        case "stock":
          data = await reportingService.getStockSummaryReport(params);
          break;
        case "production":
          data = await reportingService.getProductionReport(params);
          break;
        case "collections":
          data = await reportingService.getCollectionsReport(params);
          break;
        case "receivables":
          data = await reportingService.getReceivablesReport(params);
          break;
        case "audit":
          data = await reportingService.getAuditReport(params);
          break;
        default:
          throw new AppError(`Unknown report type: ${reportType}`, 400);
      }

      await auditService.log({
        organizationId: orgId,
        userId: req.user?.id,
        userEmail: req.user?.email,
        action: "EXPORT",
        entity: "REPORT",
        details: { reportType, format: "JSON" },
      });

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportType}-report-${new Date().toISOString().slice(0, 10)}.json"`,
      );
      return res.json(data);
    }
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/reports/:report/export - Export report to CSV or JSON
reportingRouter.get(
  "/:report/export",
  requireAuth,
  authorize("report", "read"),
  handleReportExport,
);

// POST /api/v1/reports/export or /exports - Authorized export trigger
reportingRouter.post(
  ["/export", "/exports"],
  requireAuth,
  authorize("report", "read"),
  handleReportExport,
);

// GET /api/v1/reports/:report - Filtered report rows
reportingRouter.get(
  "/:report",
  requireAuth,
  authorize("report", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const reportParam = Array.isArray(req.params.report)
        ? req.params.report[0]
        : req.params.report;
      const reportType = String(reportParam || "").toLowerCase();
      const role = req.user?.role;

      // Scoping rules
      if (
        role === "SALESMAN" &&
        ["purchase", "production", "gst", "audit"].includes(reportType)
      ) {
        throw new AppError("Salesman scope cannot access this report", 403);
      }
      if (
        role === "PRODUCTION" &&
        [
          "sales",
          "customer-sales",
          "product-sales",
          "gst",
          "receivables",
          "collections",
          "audit",
        ].includes(reportType)
      ) {
        throw new AppError("Production scope cannot access this report", 403);
      }

      const orgId = getSessionOrgId(req);

      const params = {
        organizationId: orgId,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        customerId: req.query.customerId as string | undefined,
        salesmanId:
          role === "SALESMAN"
            ? req.user!.id
            : (req.query.salesmanId as string | undefined),
        supplierId: req.query.supplierId as string | undefined,
        recipeId: req.query.recipeId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        paymentMode: req.query.paymentMode as string | undefined,
      };

      let result: unknown;
      switch (reportType.toLowerCase()) {
        case "sales":
          result = await reportingService.getSalesReport(params);
          break;
        case "customer-sales":
          result = await reportingService.getCustomerWiseSalesReport(params);
          break;
        case "product-sales":
          result = await reportingService.getProductWiseSalesReport(params);
          break;
        case "stock-ledger":
          result = await reportingService.getStockLedgerReport(params);
          break;
        case "gst":
          result = await reportingService.getGSTOutwardSummary(params);
          break;
        case "purchase":
          result = await reportingService.getPurchaseReport(params);
          break;
        case "stock":
          result = await reportingService.getStockSummaryReport(params);
          break;
        case "production":
          result = await reportingService.getProductionReport(params);
          break;
        case "collections":
          result = await reportingService.getCollectionsReport(params);
          break;
        case "receivables":
          result = await reportingService.getReceivablesReport(params);
          break;
        default:
          throw new AppError(`Unknown report: ${reportType}`, 400);
      }

      if (
        req.query.limit !== undefined ||
        req.query.page !== undefined ||
        req.query.offset !== undefined
      ) {
        const paginationParams = parsePaginationQuery(req.query, {
          limit: 50,
          maxLimit: 100,
        });
        const record = result as Record<string, unknown>;
        const arrayKey = [
          "rows",
          "items",
          "entries",
          "movements",
          "runs",
          "invoices",
          "receivables",
        ].find((k) => Array.isArray(record[k]));
        if (arrayKey) {
          const { items, pagination } = paginateArray(
            record[arrayKey] as unknown[],
            paginationParams,
          );
          res.json({
            ...record,
            [arrayKey]: items,
            pagination,
          });
          return;
        }
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
