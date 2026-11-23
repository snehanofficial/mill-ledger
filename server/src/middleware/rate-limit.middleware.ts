import type { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60 * 1000; // 1 minute
  const max = options.max ?? 1000;
  const message =
    options.message ?? "Rate limit exceeded, please try again later.";

  const store = new Map<string, RateLimitRecord>();

  // Periodically clean up expired entries every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const ip =
      req.ip ||
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const now = Date.now();
    let record = store.get(ip);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      store.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("RateLimit-Limit", max.toString());
    res.setHeader("RateLimit-Remaining", remaining.toString());
    res.setHeader("RateLimit-Reset", resetSeconds.toString());
    res.setHeader("X-RateLimit-Limit", max.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000).toString());

    if (record.count > max) {
      res.setHeader("Retry-After", resetSeconds.toString());
      res.status(429).json({
        error: "Too Many Requests",
        message,
      });
      return;
    }

    next();
  };
}
