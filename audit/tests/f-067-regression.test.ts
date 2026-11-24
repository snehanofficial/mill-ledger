import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-067: Optimistic Mutations with Rollback Handlers Across Server Workflows (TanStack Query v5 Best Practices)", () => {
  const ordersPagePath = path.resolve(__dirname, "../../client/src/pages/orders-page.tsx");
  const settingsPagePath = path.resolve(__dirname, "../../client/src/pages/settings-page.tsx");
  const dispatchPagePath = path.resolve(__dirname, "../../client/src/pages/dispatch-page.tsx");

  it("ensures approveMutation in orders-page defines onMutate, onError rollback, and onSettled invalidation", () => {
    const source = fs.readFileSync(ordersPagePath, "utf8");

    // approveMutation must have onMutate with optimistic update and snapshot
    expect(source).toMatch(/approveMutation = useMutation\(\{[\s\S]*?onMutate:\s*async\s*\(orderId/);
    expect(source).toMatch(/cancelQueries\(\{\s*queryKey:\s*\["sales-orders"\]/);
    expect(source).toMatch(/setQueryData[\s\S]*?status:\s*"APPROVED"/);

    // approveMutation must have onError rollback
    expect(source).toMatch(/onError:\s*\(err:\s*any,\s*_orderId,\s*context\)\s*=>\s*\{[\s\S]*?setQueryData\(\["sales-orders"\],\s*context\.previousData\)/);

    // approveMutation must have onSettled invalidation
    expect(source).toMatch(/onSettled:\s*\(\)\s*=>\s*\{[\s\S]*?invalidateQueries\(\{\s*queryKey:\s*\["sales-orders"\]/);
  });

  it("ensures rejectMutation in orders-page defines onMutate, onError rollback, and onSettled invalidation", () => {
    const source = fs.readFileSync(ordersPagePath, "utf8");

    // rejectMutation must have onMutate with optimistic update and snapshot
    expect(source).toMatch(/rejectMutation = useMutation\(\{[\s\S]*?onMutate:\s*async\s*\(\{/);
    expect(source).toMatch(/setQueryData[\s\S]*?status:\s*"REJECTED"/);

    // rejectMutation must have onError rollback
    expect(source).toMatch(/onError:\s*\(err:\s*any,\s*_vars,\s*context\)\s*=>\s*\{[\s\S]*?setQueryData\(\["sales-orders"\],\s*context\.previousData\)/);

    // rejectMutation must have onSettled invalidation
    expect(source).toMatch(/onSettled:\s*\(\)\s*=>\s*\{[\s\S]*?invalidateQueries\(\{\s*queryKey:\s*\["sales-orders"\]/);
  });

  it("ensures toggleUserMutation in settings-page defines onMutate, onError rollback, and onSettled invalidation", () => {
    const source = fs.readFileSync(settingsPagePath, "utf8");

    // toggleUserMutation must have onMutate with optimistic update and snapshot
    expect(source).toMatch(/toggleUserMutation = useMutation\(\{[\s\S]*?onMutate:\s*async\s*\(\{/);
    expect(source).toMatch(/cancelQueries\(\{\s*queryKey:\s*\["admin-users"\]/);
    expect(source).toMatch(/setQueryData[\s\S]*?isActive\s*\}\s*:\s*u/);

    // toggleUserMutation must have onError rollback
    expect(source).toMatch(/onError:\s*\(err:\s*any,\s*_vars,\s*context\)\s*=>\s*\{[\s\S]*?setQueryData\(\["admin-users"\],\s*context\.previousUsers\)/);

    // toggleUserMutation must have onSettled invalidation
    expect(source).toMatch(/onSettled:\s*\(\)\s*=>\s*\{[\s\S]*?invalidateQueries\(\{\s*queryKey:\s*\["admin-users"\]/);
  });

  it("ensures dispatchMutation in dispatch-page defines onMutate, onError rollback, and onSettled invalidation", () => {
    const source = fs.readFileSync(dispatchPagePath, "utf8");

    // dispatchMutation must have onMutate with optimistic update and snapshot
    expect(source).toMatch(/dispatchMutation = useMutation\(\{[\s\S]*?onMutate:\s*async\s*\(payload\)/);
    expect(source).toMatch(/setQueryData[\s\S]*?fulfilmentStatus:\s*"FULFILLED"/);

    // dispatchMutation must have onError rollback
    expect(source).toMatch(/onError:\s*\(err:\s*any,\s*_payload,\s*context\)\s*=>\s*\{[\s\S]*?setQueryData\(\["sales-orders"\],\s*context\.previousOrders\)/);

    // dispatchMutation must have onSettled invalidation
    expect(source).toMatch(/onSettled:\s*\(\)\s*=>\s*\{[\s\S]*?invalidateQueries\(\{\s*queryKey:\s*\["dispatches"\]/);
  });
});
