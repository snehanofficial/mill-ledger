import { describe, expect, it, vi } from "vitest";
import { authorize, type AuthenticatedRequest } from "./auth.middleware.js";
import { AppError } from "./error.middleware.js";
import type { Response } from "express";

describe("Auth and authorization middleware", () => {
  const mockResponse = {} as Response;

  it("returns 401 when req.user is missing", () => {
    const req = {} as AuthenticatedRequest;
    const next = vi.fn();

    const middleware = authorize("order", "read");
    middleware(req, mockResponse, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(401);
  });

  it("returns 403 when user role lacks RBAC permission (auditor write prevention)", () => {
    const req = {
      user: {
        id: "accountant-1",
        email: "accountant@millledger.local",
        role: "ACCOUNTANT",
        isActive: true,
      },
      body: {},
    } as AuthenticatedRequest;
    const next = vi.fn();

    const middleware = authorize("invoice", "create");
    middleware(req, mockResponse, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain("lacks permission create on invoice");
  });

  it("returns 403 when ABAC evaluation fails (cross-salesman violation)", () => {
    const req = {
      user: {
        id: "salesman-1",
        email: "salesman1@millledger.local",
        role: "SALESMAN",
        isActive: true,
      },
      body: {
        creatorId: "salesman-2",
        status: "draft",
      },
    } as AuthenticatedRequest;
    const next = vi.fn();

    const middleware = authorize("order", "update");
    middleware(req, mockResponse, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
  });

  it("calls next() when user has both RBAC and ABAC permissions", () => {
    const req = {
      user: {
        id: "salesman-1",
        email: "salesman1@millledger.local",
        role: "SALESMAN",
        isActive: true,
      },
      body: {
        creatorId: "salesman-1",
        status: "draft",
      },
    } as AuthenticatedRequest;
    const next = vi.fn();

    const middleware = authorize("order", "update");
    middleware(req, mockResponse, next);

    expect(next).toHaveBeenCalledWith();
  });
});
