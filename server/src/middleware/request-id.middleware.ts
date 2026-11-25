import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Middleware that assigns a unique correlation ID (X-Request-Id) to each incoming request.
 * If the client already supplies an X-Request-Id header, that ID is preserved and propagated.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const headerId = req.headers["x-request-id"];
  const requestId =
    typeof headerId === "string" && headerId.trim().length > 0
      ? headerId.trim()
      : randomUUID();

  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}
