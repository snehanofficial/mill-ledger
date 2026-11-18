import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { env } from "./config/env.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { salesRouter } from "./modules/sales/sales.routes.js";
import { productionRouter } from "./modules/production/production.routes.js";
import { inventoryRouter } from "./modules/inventory/inventory.routes.js";
import { financeRouter } from "./modules/finance/finance.routes.js";
import { paymentRouter } from "./modules/finance/payment.routes.js";
import { reportingRouter } from "./modules/reporting/reporting.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  // Better Auth handler
  app.use("/api/auth", toNodeHandler(auth));

  app.use(express.json());

  // API v1 routes
  app.use("/api/v1", authRouter);
  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/sales", salesRouter);
  app.use("/api/v1/orders", salesRouter);
  app.use("/api/v1/dispatches", salesRouter);
  app.use("/api/v1/production", productionRouter);
  app.use("/api/v1/production-runs", productionRouter);
  app.use("/api/v1/inventory", inventoryRouter);
  app.use("/api/v1/purchase-receipts", inventoryRouter);
  app.use("/api/v1/finance", financeRouter);
  app.use("/api/v1/invoices", financeRouter);
  app.use("/api/v1/payments", paymentRouter);
  app.use("/api/v1/reports", reportingRouter);
  app.use("/api/v1/dashboard", reportingRouter);

  // Backward compatibility alias for health check
  app.use("/api/health", healthRouter);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
