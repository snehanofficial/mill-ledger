import type { NextFunction, Request, Response } from "express";
import type { ApiErrorResponse } from "@mill-ledger/shared";
import { ZodError } from "zod";

export function getRequestId(req: Request, res: Response): string | undefined {
  return (
    req.id ||
    (typeof req.headers["x-request-id"] === "string"
      ? req.headers["x-request-id"]
      : (res.getHeader("X-Request-Id") as string) || undefined)
  );
}

export function sendErrorResponse(
  req: Request,
  res: Response,
  statusCode: number,
  payload: Omit<ApiErrorResponse, "requestId">,
): void {
  const body: ApiErrorResponse = {
    ...payload,
    requestId: getRequestId(req, res),
  };
  res.status(statusCode).json(body);
}

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
  if (err instanceof ZodError) {
    const flattened = err.flatten();
    const message =
      err.issues.map((i) => i.message).join(", ") || "Validation Error";
    sendErrorResponse(req, res, 400, {
      code: "VALIDATION_ERROR",
      message,
      fieldErrors: flattened.fieldErrors,
      details: flattened,
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

    sendErrorResponse(req, res, err.statusCode, {
      code: defaultCode,
      message: err.message,
      ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
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
    sendErrorResponse(req, res, 413, {
      code: "PAYLOAD_TOO_LARGE",
      message: "Request entity too large",
    });
    return;
  }

  // PostgreSQL 23503 / Prisma P2003: Foreign Key Constraint Violation
  if (errObj.code === "P2003" || errObj.code === "23503") {
    sendErrorResponse(req, res, 400, {
      code: "FOREIGN_KEY_VIOLATION",
      message: "Referenced record does not exist",
    });
    return;
  }

  // PostgreSQL 23505 / Prisma P2002: Unique Constraint Violation
  if (errObj.code === "P2002" || errObj.code === "23505") {
    sendErrorResponse(req, res, 409, {
      code: "UNIQUE_CONSTRAINT_VIOLATION",
      message: "Conflict: unique constraint violation",
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
    sendErrorResponse(req, res, 409, {
      code: "CHECK_CONSTRAINT_VIOLATION",
      message: "Insufficient stock: cannot reduce stock balance below zero",
    });
    return;
  }

  // PostgreSQL 40001 / 40P01 / Prisma P2034: Transaction Serialization / Deadlock Conflict
  if (
    errObj.code === "P2034" ||
    errObj.code === "40001" ||
    errObj.code === "40P01"
  ) {
    sendErrorResponse(req, res, 409, {
      code: "TRANSACTION_CONFLICT",
      message: "Transaction conflict: please retry operation",
    });
    return;
  }

  // Unhandled internal errors: NEVER leak stack trace or internal database details (CWE-209 / OWASP API8:2023)
  console.error("Unhandled Server Error:", err);
  sendErrorResponse(req, res, 500, {
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal Server Error",
  });
}
