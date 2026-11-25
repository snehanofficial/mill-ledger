import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { z } from "zod";
import { AppError, errorHandler } from "./error.middleware.js";

function createMockReqRes(requestId = "test-req-123") {
  const req = {
    id: requestId,
    headers: { "x-request-id": requestId },
  } as unknown as Request;

  let statusCode = 200;
  let responseData: any = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
    getHeader(_name: string) {
      return requestId;
    },
  } as unknown as Response;

  const getStatus = () => statusCode;
  const getData = () => responseData;

  return { req, res, getStatus, getData };
}

describe("F-034 Error Envelope Middleware", () => {
  it("formats Zod validation errors with code, fieldErrors, and requestId", () => {
    const testSchema = z.object({
      name: z.string().min(1, "Name is required"),
      age: z.number().min(18, "Must be at least 18"),
    });

    const parsed = testSchema.safeParse({ name: "", age: 10 });
    expect(parsed.success).toBe(false);

    const { req, res, getStatus, getData } = createMockReqRes("req-zod-456");
    errorHandler(parsed.error!, req, res, () => {});

    expect(getStatus()).toBe(400);
    const data = getData();
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.requestId).toBe("req-zod-456");
    expect(data.message).toBeDefined();
    expect(data.error).toBeUndefined();
    expect(data.fieldErrors).toBeDefined();
    expect(data.fieldErrors.name).toBeDefined();
    expect(data.fieldErrors.age).toBeDefined();
    expect(data.stack).toBeUndefined();
  });

  it("formats AppError with correct status, mapped code, and requestId", () => {
    const notFoundError = new AppError("Order SO-123 not found", 404);
    const { req, res, getStatus, getData } = createMockReqRes("req-app-789");

    errorHandler(notFoundError, req, res, () => {});

    expect(getStatus()).toBe(404);
    const data = getData();
    expect(data.code).toBe("NOT_FOUND");
    expect(data.message).toBe("Order SO-123 not found");
    expect(data.error).toBeUndefined();
    expect(data.requestId).toBe("req-app-789");
    expect(data.stack).toBeUndefined();
  });

  it("formats 413 PayloadTooLargeError into standard envelope", () => {
    const payloadErr = new Error("Request entity too large");
    (payloadErr as any).status = 413;
    (payloadErr as any).type = "entity.too.large";

    const { req, res, getStatus, getData } = createMockReqRes("req-413");
    errorHandler(payloadErr, req, res, () => {});

    expect(getStatus()).toBe(413);
    const data = getData();
    expect(data.code).toBe("PAYLOAD_TOO_LARGE");
    expect(data.message).toBe("Request entity too large");
    expect(data.error).toBeUndefined();
    expect(data.requestId).toBe("req-413");
  });

  it("maps Postgres/Prisma P2003 foreign key violation to 400 BAD_REQUEST", () => {
    const fkErr = new Error("Foreign key constraint violated");
    (fkErr as any).code = "P2003";

    const { req, res, getStatus, getData } = createMockReqRes("req-p2003");
    errorHandler(fkErr, req, res, () => {});

    expect(getStatus()).toBe(400);
    const data = getData();
    expect(data.code).toBe("FOREIGN_KEY_VIOLATION");
    expect(data.message).toBe("Referenced record does not exist");
    expect(data.requestId).toBe("req-p2003");
    expect(data.stack).toBeUndefined();
  });

  it("maps Postgres/Prisma P2002 unique constraint violation to 409 CONFLICT", () => {
    const uniqueErr = new Error("Unique constraint failed");
    (uniqueErr as any).code = "P2002";

    const { req, res, getStatus, getData } = createMockReqRes("req-p2002");
    errorHandler(uniqueErr, req, res, () => {});

    expect(getStatus()).toBe(409);
    const data = getData();
    expect(data.code).toBe("UNIQUE_CONSTRAINT_VIOLATION");
    expect(data.message).toBe("Conflict: unique constraint violation");
    expect(data.requestId).toBe("req-p2002");
    expect(data.stack).toBeUndefined();
  });

  it("maps Postgres/Prisma P2004 check constraint violation to 409 CONFLICT", () => {
    const checkErr = new Error("chk_current_stock_non_negative violated");
    (checkErr as any).code = "P2004";

    const { req, res, getStatus, getData } = createMockReqRes("req-p2004");
    errorHandler(checkErr, req, res, () => {});

    expect(getStatus()).toBe(409);
    const data = getData();
    expect(data.code).toBe("CHECK_CONSTRAINT_VIOLATION");
    expect(data.message).toContain("cannot reduce stock balance below zero");
    expect(data.requestId).toBe("req-p2004");
    expect(data.stack).toBeUndefined();
  });

  it("maps Postgres/Prisma P2034 transaction conflict to 409 CONFLICT", () => {
    const txErr = new Error("Transaction conflict");
    (txErr as any).code = "P2034";

    const { req, res, getStatus, getData } = createMockReqRes("req-p2034");
    errorHandler(txErr, req, res, () => {});

    expect(getStatus()).toBe(409);
    const data = getData();
    expect(data.code).toBe("TRANSACTION_CONFLICT");
    expect(data.message).toContain("Transaction conflict: please retry operation");
    expect(data.requestId).toBe("req-p2034");
    expect(data.stack).toBeUndefined();
  });

  it("sanitizes unhandled 500 errors and never leaks stack or internals (CWE-209)", () => {
    const unhandled = new Error("Sensitive database table user_credentials leaked!");
    unhandled.stack = "Error at Object.<anonymous> (/var/www/internal/server.ts:123:45)";

    const { req, res, getStatus, getData } = createMockReqRes("req-500");
    errorHandler(unhandled, req, res, () => {});

    expect(getStatus()).toBe(500);
    const data = getData();
    expect(data.code).toBe("INTERNAL_SERVER_ERROR");
    expect(data.message).toBe("Internal Server Error");
    expect(data.error).toBeUndefined();
    expect(data.requestId).toBe("req-500");
    expect(data.stack).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain("user_credentials");
    expect(JSON.stringify(data)).not.toContain("/var/www/internal");
  });
});
