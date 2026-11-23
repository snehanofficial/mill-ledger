import { describe, expect, it } from "vitest";
import { AppError, errorHandler } from "../../server/src/middleware/error.middleware.js";
import { createOrderSchema } from "../../shared/src/index.js";

function createMock(reqId = "trace-uuid-abc") {
  const req: any = {
    id: reqId,
    headers: { "x-request-id": reqId },
  };
  let statusCode = 200;
  let sentJson: any = null;
  const res: any = {
    status: (s: number) => {
      statusCode = s;
      return res;
    },
    json: (j: any) => {
      sentJson = j;
      return res;
    },
    getHeader: () => reqId,
  };
  return {
    req,
    res,
    get: () => ({ status: statusCode, json: sentJson }),
  };
}

describe("F-034 Regression Test: RFC 7807 Error Envelope and Error Mapping", () => {
  it("enforces standard envelope structure on Zod validation failure", () => {
    const parsed = createOrderSchema.safeParse({});
    expect(parsed.success).toBe(false);

    const { req, res, get } = createMock("req-001");
    errorHandler(parsed.error!, req, res, () => {});

    const { status, json } = get();
    expect(status).toBe(400);
    expect(json.code).toBe("VALIDATION_ERROR");
    expect(json.message).toBeDefined();
    expect(json.error).toBeDefined();
    expect(json.fieldErrors).toBeDefined();
    expect(json.requestId).toBe("req-001");
    expect(json.stack).toBeUndefined();
  });

  it("enforces standard envelope structure on AppError domain failures", () => {
    const appErr = new AppError("Entity not found", 404);
    const { req, res, get } = createMock("req-002");
    errorHandler(appErr, req, res, () => {});

    const { status, json } = get();
    expect(status).toBe(404);
    expect(json.code).toBe("NOT_FOUND");
    expect(json.message).toBe("Entity not found");
    expect(json.error).toBe("Entity not found");
    expect(json.requestId).toBe("req-002");
  });

  it("enforces standard envelope on foreign key violation (P2003 / 23503)", () => {
    const err: any = new Error("Foreign key violation");
    err.code = "P2003";

    const { req, res, get } = createMock("req-003");
    errorHandler(err, req, res, () => {});

    const { status, json } = get();
    expect(status).toBe(400);
    expect(json.code).toBe("FOREIGN_KEY_VIOLATION");
    expect(json.message).toBe("Referenced record does not exist");
    expect(json.requestId).toBe("req-003");
    expect(json.stack).toBeUndefined();
  });

  it("enforces standard envelope on unique constraint violation (P2002 / 23505)", () => {
    const err: any = new Error("Unique constraint collision");
    err.code = "P2002";

    const { req, res, get } = createMock("req-004");
    errorHandler(err, req, res, () => {});

    const { status, json } = get();
    expect(status).toBe(409);
    expect(json.code).toBe("UNIQUE_CONSTRAINT_VIOLATION");
    expect(json.message).toBe("Conflict: unique constraint violation");
    expect(json.requestId).toBe("req-004");
  });

  it("sanitizes unhandled 500 errors to prevent CWE-209 information disclosure", () => {
    const err: any = new Error("PrismaClientKnownRequestError: column users.password_hash does not exist");
    err.stack = "at /home/user/app/node_modules/@prisma/client/runtime.js:123";

    const { req, res, get } = createMock("req-005");
    errorHandler(err, req, res, () => {});

    const { status, json } = get();
    expect(status).toBe(500);
    expect(json.code).toBe("INTERNAL_SERVER_ERROR");
    expect(json.message).toBe("Internal Server Error");
    expect(json.error).toBe("Internal Server Error");
    expect(json.requestId).toBe("req-005");
    expect(json.stack).toBeUndefined();
    expect(JSON.stringify(json)).not.toContain("password_hash");
    expect(JSON.stringify(json)).not.toContain("PrismaClient");
  });
});
