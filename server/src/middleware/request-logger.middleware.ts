import type { Request, Response, NextFunction } from "express";

/**
 * Redacts sensitive fields such as passwords, tokens, and secrets from logged data.
 */
export function sanitizeDetails(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (
      /password|token|secret|authorization|cookie|session/i.test(key)
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Structured HTTP request logging middleware.
 * Formats request metadata, timing, and correlation ID without leaking credentials.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const requestId = req.id || req.headers["x-request-id"] || "unknown";

  // Capture response completion to record status and latency
  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;
    const user = (req as any).user;

    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
      userId: user?.id,
      userRole: user?.role,
    };

    // Use stdout for structured JSON request log
    if (statusCode >= 500) {
      console.error(JSON.stringify({ level: "ERROR", ...logEntry }));
    } else if (statusCode >= 400) {
      console.warn(JSON.stringify({ level: "WARN", ...logEntry }));
    } else {
      console.log(JSON.stringify({ level: "INFO", ...logEntry }));
    }
  });

  next();
}
