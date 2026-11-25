/**
 * AUDIT-ONLY PLAYWRIGHT TEST
 * Task: Inspect Dexie / IndexedDB contents, token leakage, and logout clearing behavior
 * Standards: OWASP Top 10:2021 A02 (Cryptographic Failures), A01 (Broken Access Control),
 *            OWASP ASVS v4.0.3 Sec 3.5.3, Sec 8.3
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("Verify Dexie IndexedDB contents, sensitive data, and persistence on logout", async ({ page }) => {
  // 1. Navigate to login
  await page.goto("/auth/login");
  await page.waitForLoadState("networkidle");

  // Fill credentials for Salesman
  await page.fill('input[type="email"]', "salesman1@millledger.local");
  await page.fill('input[type="password"]', "SalesmanPassword123!");
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard or orders
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 10000 });

  // Navigate to /orders/new to trigger customer/product preloading or cache
  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");

  // Inspect localStorage and sessionStorage
  const storageDump = await page.evaluate(() => {
    const local: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      local[k] = localStorage.getItem(k) || "";
    }
    const session: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)!;
      session[k] = sessionStorage.getItem(k) || "";
    }
    return { local, session };
  });

  // Inject a mock offline order into Dexie outbox to simulate offline order creation
  await page.evaluate(async () => {
    // Open IndexedDB mill_ledger_offline_db directly
    const req = indexedDB.open("mill_ledger_offline_db");
    await new Promise<void>((resolve, reject) => {
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(["outbox", "customers"], "readwrite");
          const outboxStore = tx.objectStore("outbox");
          outboxStore.put({
            id: "audit-test-order-uuid-1",
            idempotencyKey: "audit-idem-1",
            schemaVersion: 1,
            userId: "salesman-user-id",
            deviceId: "audit-device-id",
            customerId: "cust-1",
            customerName: "Sensitive Customer PII Ltd",
            customerState: "MH",
            pricedAt: new Date().toISOString(),
            status: "queued",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            attempts: 0,
            items: [
              {
                productVariantId: "var-1",
                sku: "WHEAT-FLOUR-10KG",
                name: "Atta",
                quantity: 50,
                quotedUnitPrice: 350,
              },
            ],
          });
          const custStore = tx.objectStore("customers");
          custStore.put({
            id: "cust-1",
            code: "CUST-001",
            name: "Secret Retailer Corp",
            state: "KA",
            gstin: "29AAAAA0000A1Z5",
            phone: "+91-9876543210",
            address: "123 Sensitive Street, Bangalore",
            organizationId: "org-1",
            updatedAt: new Date().toISOString(),
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        } catch (e) {
          reject(e);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });

  // Verify Dexie contents while logged in
  const dbBeforeLogout = await page.evaluate(async () => {
    return new Promise<{ outboxCount: number; customerCount: number; sampleCustomer: any }>((resolve, reject) => {
      const req = indexedDB.open("mill_ledger_offline_db");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(["outbox", "customers"], "readonly");
        const outboxReq = tx.objectStore("outbox").getAll();
        const custReq = tx.objectStore("customers").getAll();
        tx.oncomplete = () => {
          resolve({
            outboxCount: outboxReq.result.length,
            customerCount: custReq.result.length,
            sampleCustomer: custReq.result[0] || null,
          });
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  // Perform Logout
  // Click user menu or sign out button
  const signOutBtn = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), [aria-label="Sign out"]');
  if (await signOutBtn.count() > 0) {
    await signOutBtn.first().click();
  } else {
    // Invoke sign out directly through client
    await page.evaluate(async () => {
      const res = await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
      window.location.href = "/auth/login";
    });
  }

  await page.waitForURL((url) => url.pathname.includes("/auth/login"), { timeout: 10000 });
  await page.waitForLoadState("networkidle");

  // Inspect Dexie IndexedDB contents AFTER logout
  const dbAfterLogout = await page.evaluate(async () => {
    return new Promise<{ outboxCount: number; customerCount: number; sampleCustomer: any }>((resolve, reject) => {
      const req = indexedDB.open("mill_ledger_offline_db");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(["outbox", "customers"], "readonly");
        const outboxReq = tx.objectStore("outbox").getAll();
        const custReq = tx.objectStore("customers").getAll();
        tx.oncomplete = () => {
          resolve({
            outboxCount: outboxReq.result.length,
            customerCount: custReq.result.length,
            sampleCustomer: custReq.result[0] || null,
          });
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  const auditReport = {
    storageDump,
    dbBeforeLogout,
    dbAfterLogout,
    clearedOnLogout: dbAfterLogout.outboxCount === 0 && dbAfterLogout.customerCount === 0,
  };

  fs.writeFileSync("audit/evidence/dexie-logout-audit.json", JSON.stringify(auditReport, null, 2));

  console.log("Dexie Audit Results:", JSON.stringify(auditReport, null, 2));

  // Confirm that Dexie was NOT cleared on logout
  expect(dbAfterLogout.customerCount).toBeGreaterThan(0);
  expect(dbAfterLogout.outboxCount).toBeGreaterThan(0);
});
