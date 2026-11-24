import type { Request, Response, NextFunction } from "express";

/**
 * Request timeout middleware (F-102 & OWASP A05:2021).
 * Guards against hung sockets and client starvation by enforcing a maximum execution window.
 */
export function requestTimeoutMiddleware(timeoutMs = 30000) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          code: "GATEWAY_TIMEOUT",
          message: "Request timed out",
          error: "Gateway Timeout",
        });
      }
    }, timeoutMs);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}
