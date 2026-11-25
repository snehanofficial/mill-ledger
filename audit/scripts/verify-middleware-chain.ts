/**
 * AUDIT-ONLY SCRIPT
 * Task: Introspect and verify middleware chain, Express 5 specifics, and 404/error handling
 */
import { createServer } from "node:http";
import { createApp } from "../../server/src/app.js";

async function main() {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    console.log("=== VERIFYING UNKNOWN ROUTE 404 BEHAVIOR ===");
    const resNotFound = await fetch(`${baseUrl}/api/v1/does-not-exist`);
    console.log("Status Code:", resNotFound.status);
    console.log("Content-Type:", resNotFound.headers.get("content-type"));
    const textNotFound = await resNotFound.text();
    console.log("Response Body (first 200 chars):", JSON.stringify(textNotFound.slice(0, 200)));

    console.log("\n=== VERIFYING REQUEST ID HEADER ===");
    const resReqId = await fetch(`${baseUrl}/api/health`);
    console.log("x-request-id present:", !!resReqId.headers.get("x-request-id"));
    console.log("All headers on /api/health:", Object.fromEntries(resReqId.headers.entries()));

    console.log("\n=== VERIFYING RATE LIMIT ON API V1 ===");
    const resHealth = await fetch(`${baseUrl}/api/v1/health`);
    console.log("Rate limit headers on /api/v1/health:");
    console.log("ratelimit-limit:", resHealth.headers.get("ratelimit-limit"));
    console.log("x-ratelimit-limit:", resHealth.headers.get("x-ratelimit-limit"));

    console.log("\n=== VERIFYING BODY PARSER LIMIT ===");
    // Test sending large payload (>100kb default)
    const largeData = "x".repeat(150 * 1024);
    const resLarge = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: largeData }),
    });
    console.log("Status for 150KB body on unauthenticated endpoint:", resLarge.status);
    const largeText = await resLarge.text();
    console.log("Response for large body:", largeText);

    console.log("\n=== VERIFYING ERROR ENVELOPE FORMAT ===");
    // Trigger validation error on unauthenticated/authenticated route
    const resVal = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    console.log("Status for missing body:", resVal.status);
    console.log("Response body:", await resVal.text());

  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

main().catch(console.error);
