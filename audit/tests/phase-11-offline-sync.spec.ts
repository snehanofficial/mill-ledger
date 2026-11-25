import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "audit/evidence/offline");
fs.mkdirSync(evidenceDir, { recursive: true });

test.describe("Phase 11: Offline Sync & Dexie Outbox Deep Audit", () => {
  test.describe.configure({ mode: "serial" });

  test("Scenario 1: Offline creation, persistence, reconnect, double replay", async ({ page, context }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', "salesman1@millledger.local");
    await page.fill('input[type="password"]', "SalesmanPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 10000 });

    const { customer, product, currentUserId } = await page.evaluate(async () => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");
      // @ts-ignore
      const auth = await import("/src/lib/auth-client.ts");
      const user = await auth.authClient.getSession();
      const userId = user?.id || "salesman1";

      await syncModule.refreshMasterDataSnapshot(userId);
      const customers = await dbModule.offlineDb.customers.toArray();
      const products = await dbModule.offlineDb.products.toArray();

      return {
        customer: customers[0],
        product: products.find((p: any) => p.sku === "VAR-MURUKKU-200G") || products[0],
        currentUserId: userId,
      };
    });

    await context.setOffline(true);
    await page.waitForTimeout(500);

    const orderId = `ord-s1-${Date.now()}`;
    const idempotencyKey = `idem-s1-${Date.now()}`;

    await page.evaluate(async ({ orderId, idempotencyKey, customer, product, currentUserId }) => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      const db = dbModule.offlineDb;
      const order = {
        id: orderId,
        idempotencyKey,
        schemaVersion: 1,
        userId: currentUserId,
        deviceId: "dev-test-replay",
        customerId: customer.id,
        customerName: customer.name,
        customerState: customer.state,
        pricedAt: new Date().toISOString(),
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0,
        items: [
          {
            productVariantId: product.id,
            sku: product.sku,
            name: product.name,
            quantity: 5,
            quotedUnitPrice: product.defaultPrice,
          },
        ],
      };
      await db.outbox.put(order);
    }, { orderId, idempotencyKey, customer, product, currentUserId });

    const check1 = await page.evaluate(async (orderId) => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      return await dbModule.offlineDb.outbox.get(orderId);
    }, orderId);

    await context.setOffline(false);
    await page.waitForTimeout(1000);

    const replay1 = await page.evaluate(async (userId) => {
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");
      return await syncModule.processOutbox(userId);
    }, currentUserId);

    const replay2 = await page.evaluate(async (userId) => {
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");
      return await syncModule.processOutbox(userId);
    }, currentUserId);

    const finalOrder = await page.evaluate(async (orderId) => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      return await dbModule.offlineDb.outbox.get(orderId);
    }, orderId);

    const result = {
      orderId,
      idempotencyKey,
      persistedInDb: !!check1,
      offlineStatus: check1?.status,
      replay1,
      replay2,
      finalStatus: finalOrder?.status,
      lastErrorCode: finalOrder?.lastErrorCode,
      lastErrorMessage: finalOrder?.lastErrorMessage,
      serverOrderId: finalOrder?.serverOrderId,
      serverOrderNumber: finalOrder?.serverOrderNumber,
    };

    fs.writeFileSync(path.join(evidenceDir, "scenario-1-result.json"), JSON.stringify(result, null, 2));
    console.log("Scenario 1 finished:", result);

    expect(result.persistedInDb).toBe(true);
    expect(result.finalStatus).toBe("synced");
  });

  test("Scenario 2: Stock changed meanwhile (server stock insufficient at sync time)", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', "admin@millledger.local");
    await page.fill('input[type="password"]', "AdminPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"));

    const { customer, product, currentUserId } = await page.evaluate(async () => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");
      // @ts-ignore
      const auth = await import("/src/lib/auth-client.ts");
      const user = await auth.authClient.getSession();
      const userId = user?.id || "admin";

      await syncModule.refreshMasterDataSnapshot(userId);
      const customers = await dbModule.offlineDb.customers.toArray();
      const products = await dbModule.offlineDb.products.toArray();

      return {
        customer: customers[0],
        product: products.find((p: any) => p.sku === "VAR-MURUKKU-200G") || products[0],
        currentUserId: userId,
      };
    });

    const orderId = `ord-s2-${Date.now()}`;
    const idempotencyKey = `idem-s2-${Date.now()}`;

    const syncResult = await page.evaluate(async ({ orderId, idempotencyKey, customer, product, currentUserId }) => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");

      await dbModule.offlineDb.outbox.put({
        id: orderId,
        idempotencyKey,
        schemaVersion: 1,
        userId: currentUserId,
        deviceId: "dev-test-stock",
        customerId: customer.id,
        customerName: customer.name,
        customerState: customer.state,
        pricedAt: new Date().toISOString(),
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0,
        items: [
          {
            productVariantId: product.id,
            sku: product.sku,
            name: product.name,
            quantity: 99999,
            quotedUnitPrice: product.defaultPrice,
          },
        ],
      });

      const res = await syncModule.processOutbox(currentUserId);
      const orderInDb = await dbModule.offlineDb.outbox.get(orderId);
      return { res, orderInDb };
    }, { orderId, idempotencyKey, customer, product, currentUserId });

    fs.writeFileSync(path.join(evidenceDir, "scenario-2-stock-conflict.json"), JSON.stringify(syncResult, null, 2));
    console.log("Scenario 2 finished:", syncResult);
  });

  test("Scenario 3: Session expired during replay (server returns 401)", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', "salesman1@millledger.local");
    await page.fill('input[type="password"]', "SalesmanPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"));

    const { customer, product, currentUserId } = await page.evaluate(async () => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");
      // @ts-ignore
      const auth = await import("/src/lib/auth-client.ts");
      const user = await auth.authClient.getSession();
      const userId = user?.id || "salesman1";

      await syncModule.refreshMasterDataSnapshot(userId);
      const customers = await dbModule.offlineDb.customers.toArray();
      const products = await dbModule.offlineDb.products.toArray();
      return {
        customer: customers[0],
        product: products[0],
        currentUserId: userId,
      };
    });

    const orderId = `ord-s3-${Date.now()}`;
    const idempotencyKey = `idem-s3-${Date.now()}`;

    await page.evaluate(async ({ orderId, idempotencyKey, customer, product, currentUserId }) => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      await dbModule.offlineDb.outbox.put({
        id: orderId,
        idempotencyKey,
        schemaVersion: 1,
        userId: currentUserId,
        deviceId: "dev-test-expired",
        customerId: customer.id,
        customerName: customer.name,
        customerState: customer.state,
        pricedAt: new Date().toISOString(),
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0,
        items: [
          {
            productVariantId: product.id,
            sku: product.sku,
            name: product.name,
            quantity: 5,
            quotedUnitPrice: product.defaultPrice,
          },
        ],
      });
    }, { orderId, idempotencyKey, customer, product, currentUserId });

    await page.context().clearCookies();

    const syncWithExpiredSession = await page.evaluate(async ({ orderId, currentUserId }) => {
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");

      const res = await syncModule.processOutbox(currentUserId);
      const order = await dbModule.offlineDb.outbox.get(orderId);
      return { res, order };
    }, { orderId, currentUserId });

    fs.writeFileSync(path.join(evidenceDir, "scenario-3-session-expired.json"), JSON.stringify(syncWithExpiredSession, null, 2));
    console.log("Scenario 3 finished:", syncWithExpiredSession);
  });

  test("Scenario 4: Duplicate client IDs & server idempotency", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', "admin@millledger.local");
    await page.fill('input[type="password"]', "AdminPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"));

    const dupKey = `idem-dup-${Date.now()}`;

    const dupResult = await page.evaluate(async (dupKey) => {
      // @ts-ignore
      const api = (await import("/src/lib/api-client.ts")).apiClient;
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");
      // @ts-ignore
      const auth = await import("/src/lib/auth-client.ts");
      const user = await auth.authClient.getSession();
      const userId = user?.id || "admin";

      await syncModule.refreshMasterDataSnapshot(userId);
      const customers = await dbModule.offlineDb.customers.toArray();
      const products = await dbModule.offlineDb.products.toArray();

      const customer = customers[0];
      const product = products[0];

      const payload = {
        organizationId: "MILL",
        customerId: customer.id,
        notes: "Duplicate key test",
        idempotencyKey: dupKey,
        lines: [
          {
            productVariantId: product.id,
            quantity: 2,
            unitPrice: product.defaultPrice,
          },
        ],
      };

      try {
        const res1 = await api.post("/sales/orders", payload);
        const res2 = await api.post("/sales/orders", payload);
        return {
          res1Status: res1.status,
          res1Id: res1.data?.order?.id,
          res2Status: res2.status,
          res2Id: res2.data?.order?.id,
          sameId: res1.data?.order?.id === res2.data?.order?.id,
        };
      } catch (err: any) {
        return { error: err.message, response: err.response?.data };
      }
    }, dupKey);

    fs.writeFileSync(path.join(evidenceDir, "scenario-4-idempotency.json"), JSON.stringify(dupResult, null, 2));
    console.log("Scenario 4 finished:", dupResult);
    expect(dupResult.sameId).toBe(true);
  });

  test("Scenario 5: Server rejects mid-queue (unassigned customer conflict)", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', "salesman1@millledger.local");
    await page.fill('input[type="password"]', "SalesmanPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"));

    const { customerA, product, currentUserId } = await page.evaluate(async () => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");
      // @ts-ignore
      const auth = await import("/src/lib/auth-client.ts");
      const user = await auth.authClient.getSession();
      const userId = user?.id || "salesman1";

      await syncModule.refreshMasterDataSnapshot(userId);
      const customers = await dbModule.offlineDb.customers.toArray();
      const products = await dbModule.offlineDb.products.toArray();
      return {
        customerA: customers.find((c: any) => c.code === "CUST-RET-A") || customers[0],
        product: products[0],
        currentUserId: userId,
      };
    });

    const orderId1 = `ord-mid-1-${Date.now()}`;
    const orderId2 = `ord-mid-2-${Date.now()}`;
    const orderId3 = `ord-mid-3-${Date.now()}`;

    const midQueueResult = await page.evaluate(async ({ orderId1, orderId2, orderId3, customerA, product, currentUserId }) => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");

      // Order 1: Valid (Retailer A)
      await dbModule.offlineDb.outbox.put({
        id: orderId1,
        idempotencyKey: `idem-${orderId1}`,
        schemaVersion: 1,
        userId: currentUserId,
        deviceId: "dev-test",
        customerId: customerA.id,
        customerName: customerA.name,
        customerState: customerA.state,
        pricedAt: new Date().toISOString(),
        status: "queued",
        createdAt: new Date(Date.now() - 3000).toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0,
        items: [{ productVariantId: product.id, sku: product.sku, name: product.name, quantity: 1, quotedUnitPrice: product.defaultPrice }],
      });

      // Order 2: Conflict (Unassigned Customer: CUST-DIST-B which salesman 1 cannot access)
      await dbModule.offlineDb.outbox.put({
        id: orderId2,
        idempotencyKey: `idem-${orderId2}`,
        schemaVersion: 1,
        userId: currentUserId,
        deviceId: "dev-test",
        customerId: "CUST-DIST-B",
        customerName: "Distributor B",
        customerState: "Karnataka",
        pricedAt: new Date().toISOString(),
        status: "queued",
        createdAt: new Date(Date.now() - 2000).toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0,
        items: [{ productVariantId: product.id, sku: product.sku, name: product.name, quantity: 1, quotedUnitPrice: product.defaultPrice }],
      });

      // Order 3: Valid (Retailer A)
      await dbModule.offlineDb.outbox.put({
        id: orderId3,
        idempotencyKey: `idem-${orderId3}`,
        schemaVersion: 1,
        userId: currentUserId,
        deviceId: "dev-test",
        customerId: customerA.id,
        customerName: customerA.name,
        customerState: customerA.state,
        pricedAt: new Date().toISOString(),
        status: "queued",
        createdAt: new Date(Date.now() - 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0,
        items: [{ productVariantId: product.id, sku: product.sku, name: product.name, quantity: 1, quotedUnitPrice: product.defaultPrice }],
      });

      const res = await syncModule.processOutbox(currentUserId);

      const o1 = await dbModule.offlineDb.outbox.get(orderId1);
      const o2 = await dbModule.offlineDb.outbox.get(orderId2);
      const o3 = await dbModule.offlineDb.outbox.get(orderId3);

      return {
        processSummary: res,
        order1Status: o1?.status,
        order2Status: o2?.status,
        order2Error: o2?.lastErrorMessage,
        order3Status: o3?.status,
      };
    }, { orderId1, orderId2, orderId3, customerA, product, currentUserId });

    fs.writeFileSync(path.join(evidenceDir, "scenario-5-mid-queue.json"), JSON.stringify(midQueueResult, null, 2));
    console.log("Scenario 5 finished:", midQueueResult);
  });

  test("Scenario 6: Corrupt queue entry handling", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', "admin@millledger.local");
    await page.fill('input[type="password"]', "AdminPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"));

    const corruptId = `corrupt-ord-${Date.now()}`;

    const corruptResult = await page.evaluate(async (corruptId) => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");
      // @ts-ignore
      const auth = await import("/src/lib/auth-client.ts");
      const user = await auth.authClient.getSession();
      const userId = user?.id || "admin";

      await dbModule.offlineDb.outbox.put({
        id: corruptId,
        idempotencyKey: `idem-${corruptId}`,
        schemaVersion: 99,
        userId: userId,
        deviceId: "dev-corrupt",
        customerId: "",
        customerName: "",
        customerState: "",
        pricedAt: "",
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0,
        items: undefined as any,
      });

      try {
        const res = await syncModule.processOutbox(userId);
        const order = await dbModule.offlineDb.outbox.get(corruptId);
        return { crashed: false, res, orderStatus: order?.status, error: order?.lastErrorMessage };
      } catch (err: any) {
        return { crashed: true, error: err.message, stack: err.stack };
      }
    }, corruptId);

    fs.writeFileSync(path.join(evidenceDir, "scenario-6-corrupt-entry.json"), JSON.stringify(corruptResult, null, 2));
    console.log("Scenario 6 finished:", corruptResult);
  });

  test("Scenario 7: Storage quota simulation", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', "admin@millledger.local");
    await page.fill('input[type="password"]', "AdminPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"));

    const quotaResult = await page.evaluate(async () => {
      let quotaSupported = false;
      let estimate: any = null;
      if (navigator.storage && navigator.storage.estimate) {
        quotaSupported = true;
        estimate = await navigator.storage.estimate();
      }
      return {
        quotaSupported,
        estimate,
        hasPersistentStorageApi: !!(navigator.storage && navigator.storage.persist),
      };
    });

    fs.writeFileSync(path.join(evidenceDir, "scenario-7-quota.json"), JSON.stringify(quotaResult, null, 2));
    console.log("Scenario 7 finished:", quotaResult);
  });

  test("Scenario 8: Two tabs at once (navigator.locks mutex verification)", async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto("/auth/login");
    await page1.fill('input[type="email"]', "salesman1@millledger.local");
    await page1.fill('input[type="password"]', "SalesmanPassword123!");
    await page1.click('button[type="submit"]');
    await page1.waitForURL((url) => !url.pathname.includes("/auth/login"));

    await page2.goto("/orders");
    await page2.waitForLoadState("networkidle");

    const { customer, product, currentUserId } = await page1.evaluate(async () => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      // @ts-ignore
      const syncModule = await import("/src/offline/sync-engine.ts");
      // @ts-ignore
      const auth = await import("/src/lib/auth-client.ts");
      const user = await auth.authClient.getSession();
      const userId = user?.id || "salesman1";

      await syncModule.refreshMasterDataSnapshot(userId);
      const customers = await dbModule.offlineDb.customers.toArray();
      const products = await dbModule.offlineDb.products.toArray();
      return {
        customer: customers[0],
        product: products[0],
        currentUserId: userId,
      };
    });

    const orderId = `two-tab-ord-${Date.now()}`;
    await page1.evaluate(async ({ orderId, customer, product, currentUserId }) => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      await dbModule.offlineDb.outbox.put({
        id: orderId,
        idempotencyKey: `idem-${orderId}`,
        schemaVersion: 1,
        userId: currentUserId,
        deviceId: "dev-two-tabs",
        customerId: customer.id,
        customerName: customer.name,
        customerState: customer.state,
        pricedAt: new Date().toISOString(),
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0,
        items: [{ productVariantId: product.id, sku: product.sku, name: product.name, quantity: 1, quotedUnitPrice: product.defaultPrice }],
      });
    }, { orderId, customer, product, currentUserId });

    const [resTab1, resTab2] = await Promise.all([
      page1.evaluate(async (userId) => {
        // @ts-ignore
        const syncModule = await import("/src/offline/sync-engine.ts");
        return await syncModule.processOutbox(userId);
      }, currentUserId),
      page2.evaluate(async (userId) => {
        // @ts-ignore
        const syncModule = await import("/src/offline/sync-engine.ts");
        return await syncModule.processOutbox(userId);
      }, currentUserId),
    ]);

    const mutexResult = {
      resTab1,
      resTab2,
      lockWorked: (resTab1.processed > 0 && resTab2.processed === 0) || (resTab2.processed > 0 && resTab1.processed === 0),
    };

    fs.writeFileSync(path.join(evidenceDir, "scenario-8-two-tabs-mutex.json"), JSON.stringify(mutexResult, null, 2));
    console.log("Scenario 8 finished:", mutexResult);
    await context.close();
  });

  test("UI Evaluation: Outbox Sheet, manual retry, and discard confirmation check", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', "salesman1@millledger.local");
    await page.fill('input[type="password"]', "SalesmanPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"));

    await page.goto("/orders");
    await page.waitForLoadState("networkidle");

    const testOrderId = `ui-test-ord-${Date.now()}`;
    const currentUserId = await page.evaluate(async (testOrderId) => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      // @ts-ignore
      const auth = await import("/src/lib/auth-client.ts");
      const user = await auth.authClient.getSession();
      const userId = user?.id || "salesman1";

      await dbModule.offlineDb.outbox.put({
        id: testOrderId,
        idempotencyKey: `idem-${testOrderId}`,
        schemaVersion: 1,
        userId: userId,
        deviceId: "dev-ui-test",
        customerId: "CUST-RET-A",
        customerName: "Retailer A",
        customerState: "Tamil Nadu",
        pricedAt: new Date().toISOString(),
        status: "conflict",
        lastErrorCode: "HTTP_403",
        lastErrorMessage: "Salesman is not assigned to customer Retailer A",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 1,
        items: [{ productVariantId: "var-1", sku: "VAR-MURUKKU-200G", name: "Murukku 200 g", quantity: 10, quotedUnitPrice: 50 }],
      });
      return userId;
    }, testOrderId);

    // Click Sync button in header to open outbox sheet
    const syncButton = page.locator('button[aria-label^="Sync state"]');
    await syncButton.click();
    await page.waitForTimeout(600);

    // Take screenshot of opened outbox sheet
    await page.screenshot({ path: path.join(evidenceDir, "outbox-sheet-ui.png") });

    const hasRetryButton = await page.locator('button:has-text("Retry")').count() > 0;
    const discardBtn = page.locator('button:has-text("Discard")');
    const hasDiscardButton = await discardBtn.count() > 0;

    let dialogAppeared = false;
    page.on("dialog", () => {
      dialogAppeared = true;
    });

    if (hasDiscardButton) {
      await discardBtn.first().click();
      await page.waitForTimeout(400);
    }

    const confirmationModal = page.locator('[role="alertdialog"], [role="dialog"]:has-text("Are you sure"), [role="dialog"]:has-text("Confirm")');
    const modalCount = await confirmationModal.count();

    const orderAfterDiscard = await page.evaluate(async (testOrderId) => {
      // @ts-ignore
      const dbModule = await import("/src/offline/db.ts");
      return await dbModule.offlineDb.outbox.get(testOrderId);
    }, testOrderId);

    const uiResult = {
      currentUserId,
      hasRetryButton,
      hasDiscardButton,
      nativeDialogAppeared: dialogAppeared,
      modalDialogCount: modalCount,
      discardConfirmationPresent: dialogAppeared || modalCount > 0,
      orderImmediatelyDeleted: orderAfterDiscard === undefined,
      dataRecoveryPossible: false,
    };

    fs.writeFileSync(path.join(evidenceDir, "ui-outbox-discard-audit.json"), JSON.stringify(uiResult, null, 2));
    console.log("UI Evaluation finished:", uiResult);

    expect(uiResult.hasRetryButton).toBe(true);
    expect(uiResult.hasDiscardButton).toBe(true);
    expect(uiResult.discardConfirmationPresent).toBe(false);
    expect(uiResult.orderImmediatelyDeleted).toBe(true);
  });
});
