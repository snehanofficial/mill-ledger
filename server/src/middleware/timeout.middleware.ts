import type { Request, Response, NextFunction } from "express";
import { sendErrorResponse } from "./error.middleware.js";

/**
 * Request timeout middleware (F-102 & OWASP A05:2021).
 * Guards against hung sockets and client starvation by enforcing a maximum execution window.
 */
export function requestTimeoutMiddleware(timeoutMs = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        sendErrorResponse(req, res, 504, {
          code: "GATEWAY_TIMEOUT",
          message: "Request timed out",
        });
      }
    }, timeoutMs);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}
