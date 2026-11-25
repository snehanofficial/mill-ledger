import { Router } from "express";
import { authorize, requireAuth, } from "../../middleware/auth.middleware.js";
import { reportingService } from "./reporting.service.js";
import { auditService } from "./audit.service.js";
import { AppError } from "../../middleware/error.middleware.js";
export const reportingRouter = Router();
// GET /api/v1/reports/dashboard or /api/v1/dashboard - Executive overview
reportingRouter.get(["/", "/dashboard"], requireAuth, authorize("report", "read"), async (req, res, next) => {
    try {
        const orgId = req.query.organizationId || "MILL";
        const dashboard = await reportingService.getOwnerDashboard({
            organizationId: orgId,
        });
        res.json(dashboard);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/v1/reports/audit - Audit log report
reportingRouter.get("/audit", requireAuth, authorize("report", "read"), async (req, res, next) => {
    try {
        const role = req.user?.role;
        if (role !== "ADMIN" && role !== "OWNER" && role !== "ACCOUNTANT") {
            throw new AppError("Only administrators, accountants, and owners can view audit logs", 403);
        }
        const orgId = req.query.organizationId || "MILL";
        const entity = req.query.entity;
        const action = req.query.action;
        const limit = req.query.limit
            ? parseInt(req.query.limit, 10)
            : 100;
        const logs = await auditService.getLogs({
            organizationId: orgId,
            entity,
            action,
            limit,
        });
        res.json({
            reportTitle: "System Audit Log",
            generatedAt: new Date(),
            logs,
        });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/v1/reports/:report/export - Export report to CSV or JSON
reportingRouter.get("/:report/export", requireAuth, authorize("report", "read"), async (req, res, next) => {
    try {
        const reportParam = Array.isArray(req.params.report)
            ? req.params.report[0]
            : req.params.report;
        const reportType = String(reportParam || "").toLowerCase();
        const role = req.user?.role;
        // Scoping rules
        if (role === "SALESMAN" &&
            ["purchase", "production", "gst", "audit"].includes(reportType)) {
            throw new AppError("Salesman scope cannot access this report export", 403);
        }
        if (role === "PRODUCTION" &&
            ["sales", "gst", "receivables", "collections", "audit"].includes(reportType)) {
            throw new AppError("Production scope cannot access this report export", 403);
        }
        const orgId = req.query.organizationId || "MILL";
        const format = req.query.format || "csv";
        const params = {
            organizationId: orgId,
            startDate: req.query.startDate
                ? new Date(req.query.startDate)
                : undefined,
            endDate: req.query.endDate
                ? new Date(req.query.endDate)
                : undefined,
            customerId: req.query.customerId,
            salesmanId: role === "SALESMAN"
                ? req.user.id
                : req.query.salesmanId,
            supplierId: req.query.supplierId,
            recipeId: req.query.recipeId,
        };
        if (format.toLowerCase() === "csv") {
            const csvContent = await reportingService.exportToCSV(reportType, params, req.user);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename="${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv"`);
            return res.send(csvContent);
        }
        else {
            // JSON export
            let data;
            switch (reportType.toLowerCase()) {
                case "sales":
                    data = await reportingService.getSalesReport(params);
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
            res.setHeader("Content-Disposition", `attachment; filename="${reportType}-report-${new Date().toISOString().slice(0, 10)}.json"`);
            return res.json(data);
        }
    }
    catch (err) {
        next(err);
    }
});
// GET /api/v1/reports/:report - Filtered report rows
reportingRouter.get("/:report", requireAuth, authorize("report", "read"), async (req, res, next) => {
    try {
        const reportParam = Array.isArray(req.params.report)
            ? req.params.report[0]
            : req.params.report;
        const reportType = String(reportParam || "").toLowerCase();
        const role = req.user?.role;
        // Scoping rules
        if (role === "SALESMAN" &&
            ["purchase", "production", "gst", "audit"].includes(reportType)) {
            throw new AppError("Salesman scope cannot access this report", 403);
        }
        if (role === "PRODUCTION" &&
            ["sales", "gst", "receivables", "collections", "audit"].includes(reportType)) {
            throw new AppError("Production scope cannot access this report", 403);
        }
        const orgId = req.query.organizationId || "MILL";
        const params = {
            organizationId: orgId,
            startDate: req.query.startDate
                ? new Date(req.query.startDate)
                : undefined,
            endDate: req.query.endDate
                ? new Date(req.query.endDate)
                : undefined,
            customerId: req.query.customerId,
            salesmanId: role === "SALESMAN"
                ? req.user.id
                : req.query.salesmanId,
            supplierId: req.query.supplierId,
            recipeId: req.query.recipeId,
            warehouseId: req.query.warehouseId,
            paymentMode: req.query.paymentMode,
        };
        let result;
        switch (reportType.toLowerCase()) {
            case "sales":
                result = await reportingService.getSalesReport(params);
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
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
