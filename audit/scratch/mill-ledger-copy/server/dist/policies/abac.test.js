import { describe, expect, it } from "vitest";
import { evaluateAbac } from "./abac.js";
describe("ABAC policy evaluations", () => {
    const activeAdmin = {
        id: "admin-1",
        email: "admin@millledger.local",
        role: "ADMIN",
        isActive: true,
    };
    const inactiveAdmin = {
        id: "admin-inactive",
        email: "inactive@millledger.local",
        role: "ADMIN",
        isActive: false,
    };
    const salesmanOne = {
        id: "salesman-1",
        email: "salesman1@millledger.local",
        role: "SALESMAN",
        isActive: true,
    };
    const salesmanTwo = {
        id: "salesman-2",
        email: "salesman2@millledger.local",
        role: "SALESMAN",
        isActive: true,
    };
    it("denies all operations when the user account is inactive", () => {
        const isAllowed = evaluateAbac({
            user: inactiveAdmin,
            resource: "order",
            action: "read",
        });
        expect(isAllowed).toBe(false);
    });
    it("allows active admin general access", () => {
        const isAllowed = evaluateAbac({
            user: activeAdmin,
            resource: "order",
            action: "read",
        });
        expect(isAllowed).toBe(true);
    });
    describe("Cross-salesman order boundaries", () => {
        it("allows a salesman to update their own draft order", () => {
            const isAllowed = evaluateAbac({
                user: salesmanOne,
                resource: "order",
                action: "update",
                resourceAttributes: {
                    creatorId: "salesman-1",
                    status: "draft",
                },
            });
            expect(isAllowed).toBe(true);
        });
        it("prevents salesman from updating another salesman's order (cross-salesman write block)", () => {
            const isAllowed = evaluateAbac({
                user: salesmanOne,
                resource: "order",
                action: "update",
                resourceAttributes: {
                    creatorId: "salesman-2",
                    status: "draft",
                },
            });
            expect(isAllowed).toBe(false);
        });
        it("prevents salesman from updating their own order once it is no longer draft", () => {
            const isAllowed = evaluateAbac({
                user: salesmanOne,
                resource: "order",
                action: "update",
                resourceAttributes: {
                    creatorId: "salesman-1",
                    status: "submitted",
                },
            });
            expect(isAllowed).toBe(false);
        });
        it("prevents salesman from reading an order belonging to another salesman", () => {
            const isAllowed = evaluateAbac({
                user: salesmanOne,
                resource: "order",
                action: "read",
                resourceAttributes: {
                    creatorId: "salesman-2",
                },
            });
            expect(isAllowed).toBe(false);
        });
        it("allows salesman to read their own order", () => {
            const isAllowed = evaluateAbac({
                user: salesmanOne,
                resource: "order",
                action: "read",
                resourceAttributes: {
                    creatorId: "salesman-1",
                },
            });
            expect(isAllowed).toBe(true);
        });
        it("verifies salesman 2 can access own order but cannot access salesman 1's order", () => {
            expect(evaluateAbac({
                user: salesmanTwo,
                resource: "order",
                action: "read",
                resourceAttributes: { creatorId: "salesman-2" },
            })).toBe(true);
            expect(evaluateAbac({
                user: salesmanTwo,
                resource: "order",
                action: "read",
                resourceAttributes: { creatorId: "salesman-1" },
            })).toBe(false);
        });
        it("prevents salesman from reading a customer assigned to another salesman", () => {
            const isAllowed = evaluateAbac({
                user: salesmanOne,
                resource: "customer",
                action: "read",
                resourceAttributes: {
                    assignedSalesmanId: "salesman-2",
                },
            });
            expect(isAllowed).toBe(false);
        });
        it("allows salesman to read a customer assigned to themselves", () => {
            const isAllowed = evaluateAbac({
                user: salesmanOne,
                resource: "customer",
                action: "read",
                resourceAttributes: {
                    assignedSalesmanId: "salesman-1",
                },
            });
            expect(isAllowed).toBe(true);
        });
    });
    describe("Posted document immutability", () => {
        it("denies direct updates to posted documents", () => {
            const isAllowed = evaluateAbac({
                user: activeAdmin,
                resource: "invoice",
                action: "update",
                resourceAttributes: {
                    status: "posted",
                },
            });
            expect(isAllowed).toBe(false);
        });
        it("denies direct deletion of posted documents", () => {
            const isAllowed = evaluateAbac({
                user: activeAdmin,
                resource: "production_run",
                action: "delete",
                resourceAttributes: {
                    status: "posted",
                },
            });
            expect(isAllowed).toBe(false);
        });
        it("allows deletion or update of unposted draft documents", () => {
            const isAllowed = evaluateAbac({
                user: activeAdmin,
                resource: "production_run",
                action: "update",
                resourceAttributes: {
                    status: "draft",
                },
            });
            expect(isAllowed).toBe(true);
        });
    });
});
