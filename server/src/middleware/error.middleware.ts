import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
    code?: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.fieldErrors = fieldErrors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId =
    req.id ||
    (typeof req.headers["x-request-id"] === "string"
      ? req.headers["x-request-id"]
      : (res.getHeader("X-Request-Id") as string) || undefined);

  if (err instanceof ZodError) {
    const flattened = err.flatten();
    const message =
      err.issues.map((i) => i.message).join(", ") || "Validation Error";
    res.status(400).json({
      code: "VALIDATION_ERROR",
      message,
      error: message,
      fieldErrors: flattened.fieldErrors,
      details: flattened,
      requestId,
    });
    return;
  }

  if (err instanceof AppError) {
    let defaultCode = err.code;
    if (!defaultCode) {
      switch (err.statusCode) {
        case 400:
          defaultCode =
            err.message.toLowerCase().includes("validation") ||
            err.message.toLowerCase().includes("invalid")
              ? "VALIDATION_ERROR"
              : "BAD_REQUEST";
          break;
        case 401:
          defaultCode = "UNAUTHORIZED";
          break;
        case 403:
          defaultCode = "FORBIDDEN";
          break;
        case 404:
          defaultCode = "NOT_FOUND";
          break;
        case 409:
          defaultCode = "CONFLICT";
          break;
        case 413:
          defaultCode = "PAYLOAD_TOO_LARGE";
          break;
        case 429:
          defaultCode = "RATE_LIMIT_EXCEEDED";
          break;
        default:
          defaultCode = "APPLICATION_ERROR";
      }
    }

    res.status(err.statusCode).json({
      code: defaultCode,
      message: err.message,
      error: err.message,
      ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
      requestId,
    });
    return;
  }

  const errObj = err as unknown as {
    status?: number;
    statusCode?: number;
    type?: string;
    code?: string;
    message?: string;
  };

  // HTTP 413 Payload Too Large
  if (
    errObj.status === 413 ||
    errObj.statusCode === 413 ||
    errObj.type === "entity.too.large" ||
    err.name === "PayloadTooLargeError"
  ) {
    res.status(413).json({
      code: "PAYLOAD_TOO_LARGE",
      message: "Request entity too large",
      error: "Payload Too Large",
      requestId,
    });
    return;
  }

  // PostgreSQL 23503 / Prisma P2003: Foreign Key Constraint Violation
  if (errObj.code === "P2003" || errObj.code === "23503") {
    res.status(400).json({
      code: "FOREIGN_KEY_VIOLATION",
      message: "Referenced record does not exist",
      error: "Referenced record does not exist",
      requestId,
    });
    return;
  }

  // PostgreSQL 23505 / Prisma P2002: Unique Constraint Violation
  if (errObj.code === "P2002" || errObj.code === "23505") {
    res.status(409).json({
      code: "UNIQUE_CONSTRAINT_VIOLATION",
      message: "Conflict: unique constraint violation",
      error: "Conflict: unique constraint violation",
      requestId,
    });
    return;
  }

  // PostgreSQL 23514 / Prisma P2004: Check Constraint Violation (e.g. stock non-negative)
  if (
    errObj.code === "P2004" ||
    errObj.code === "23514" ||
    (typeof err.message === "string" &&
      (err.message.includes("chk_current_stock_non_negative") ||
        err.message.includes("23514")))
  ) {
    res.status(409).json({
      code: "CHECK_CONSTRAINT_VIOLATION",
      message: "Insufficient stock: cannot reduce stock balance below zero",
      error: "Insufficient stock: cannot reduce stock balance below zero",
      requestId,
    });
    return;
  }

  // PostgreSQL 40001 / 40P01 / Prisma P2034: Transaction Serialization / Deadlock Conflict
  if (
    errObj.code === "P2034" ||
    errObj.code === "40001" ||
    errObj.code === "40P01"
  ) {
    res.status(409).json({
      code: "TRANSACTION_CONFLICT",
      message: "Transaction conflict: please retry operation",
      error: "Transaction conflict: please retry operation",
      requestId,
    });
    return;
  }

  // Unhandled internal errors: NEVER leak stack trace or internal database details (CWE-209 / OWASP API8:2023)
  console.error("Unhandled Server Error:", err);
  res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal Server Error",
    error: "Internal Server Error",
    requestId,
  });
}
