import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { userRouter } from "./modules/auth/user.routes.js";
import { salesRouter } from "./modules/sales/sales.routes.js";
import { productionRouter } from "./modules/production/production.routes.js";
import { inventoryRouter } from "./modules/inventory/inventory.routes.js";
import { purchaseRouter } from "./modules/inventory/purchase.routes.js";
import { financeRouter } from "./modules/finance/finance.routes.js";
import { paymentRouter } from "./modules/finance/payment.routes.js";
import { reportingRouter } from "./modules/reporting/reporting.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { isAllowedOrigin } from "./lib/origins.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { requestLogger } from "./middleware/request-logger.middleware.js";
import { createRateLimiter } from "./middleware/rate-limit.middleware.js";
import { requestTimeoutMiddleware } from "./middleware/timeout.middleware.js";
import { getReadiness } from "./modules/health/health.controller.js";

export function createApp() {
  const app = express();

  // Trust reverse proxy headers (e.g. ALB, Nginx, Kubernetes Ingress) for accurate req.ip (F-102)
  app.set("trust proxy", 1);

  // Request timeout guard (F-102)
  app.use(requestTimeoutMiddleware(30000));

  // Request correlation ID and structured logger
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  app.use(helmet());
  // REQ-062 & Owner Decision 2: Prevent search engine indexing of authenticated ERP APIs and endpoints
  app.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!requestOrigin || isAllowedOrigin(requestOrigin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    }),
  );

  // Aliases for password recovery (MLD / OWASP ASVS compatibility)
  app.post(
    ["/api/auth/forget-password", "/api/auth/forgot-password"],
    express.json(),
    async (req, res, next) => {
      try {
        const { email, redirectTo } = req.body || {};
        if (!email || typeof email !== "string" || !email.includes("@")) {
          return res.status(400).json({ error: "Valid email is required" });
        }
        const result = await auth.api.requestPasswordReset({
          body: {
            email: email.toLowerCase().trim(),
            redirectTo,
          },
          headers: req.headers as unknown as Headers,
        });
        return res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // Better Auth handler
  app.use("/api/auth", toNodeHandler(auth));

  app.use(express.json());

  // API rate limiting
  const apiRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 1000,
  });
  app.use(["/api/v1", "/api/health"], apiRateLimiter);

  // API v1 routes
  app.use("/api/v1", authRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/admin/users", userRouter);
  app.use("/api/v1/health", healthRouter);
  app.get(["/ready", "/api/v1/ready"], getReadiness);
  app.use("/api/v1/sales", salesRouter);
  app.use("/api/v1/orders", salesRouter);
  app.use("/api/v1/dispatches", salesRouter);
  app.use("/api/v1/production", productionRouter);
  app.use("/api/v1/production-runs", productionRouter);
  app.use("/api/v1/inventory", inventoryRouter);
  app.use("/api/v1/purchase-receipts", purchaseRouter);
  app.use("/api/v1/finance", financeRouter);
  app.use("/api/v1/invoices", financeRouter);
  app.use("/api/v1/payments", paymentRouter);
  app.use("/api/v1/reports", reportingRouter);
  app.use("/api/v1/dashboard", reportingRouter);

  // Backward compatibility alias for health check
  app.use("/api/health", healthRouter);

  // RFC 9309: Standard robots.txt response for backend API server
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain");
    res.send("User-agent: *\nDisallow: /\n");
  });

  // Serve static frontend assets and SPA fallback in production/container (F-099)
  const clientDistPath = [
    path.resolve(process.cwd(), "client/dist"),
    path.resolve(process.cwd(), "../client/dist"),
  ].find((p) => fs.existsSync(p));

  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    app.use((req, res, next) => {
      if (req.method !== "GET") {
        return next();
      }
      if (req.path.startsWith("/api") || req.path === "/ready" || req.path === "/robots.txt") {
        return next();
      }
      res.sendFile(path.join(clientDistPath, "index.html"));
    });
  }

  // 404 catch-all for unmatched routes
  app.use((req, res) => {
    const requestId =
      req.id ||
      (typeof req.headers["x-request-id"] === "string"
        ? req.headers["x-request-id"]
        : (res.getHeader("X-Request-Id") as string) || undefined);
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Route not found",
      error: "Not Found",
      requestId,
    });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
