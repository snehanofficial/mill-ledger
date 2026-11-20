/**
 * AUDIT-ONLY SCRIPT
 * Task: Verify Better Auth session handling, cookie security, expiration, logout invalidation,
 * concurrent sessions, brute-force/lockout, and user enumeration.
 */
import { createServer } from "node:http";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

async function main() {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log("=== BETTER AUTH AUDIT VERIFICATION ===");
  console.log(`Server running at ${baseUrl}`);

  try {
    // 1. Cookie Flags and Sign-in Header Inspection
    console.log("\n--- 1. COOKIE SECURITY FLAGS & ATTRIBUTES ---");
    const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        email: "admin@millledger.local",
        password: "AdminPassword123!",
      }),
    });

    console.log("Login HTTP Status:", loginRes.status);
    const setCookie = loginRes.headers.get("set-cookie") || "";
    console.log("Raw Set-Cookie:", setCookie);
    console.log("Contains HttpOnly:", /HttpOnly/i.test(setCookie));
    console.log("Contains Secure:", /Secure/i.test(setCookie));
    console.log("Contains SameSite:", /SameSite/i.test(setCookie));
    const sameSiteMatch = setCookie.match(/SameSite=([^;]+)/i);
    console.log("SameSite Value:", sameSiteMatch ? sameSiteMatch[1] : "NOT SPECIFIED");

    // 2. Database Session Lifetime and Expiration
    console.log("\n--- 2. DATABASE SESSION RECORD & EXPIRATION ---");
    const sessionRecord = await prisma.session.findFirst({
      where: { user: { email: "admin@millledger.local" } },
      orderBy: { createdAt: "desc" },
    });
    if (sessionRecord) {
      console.log("Session ID:", sessionRecord.id);
      console.log("Created At:", sessionRecord.createdAt.toISOString());
      console.log("Expires At:", sessionRecord.expiresAt.toISOString());
      const durationHours = (sessionRecord.expiresAt.getTime() - sessionRecord.createdAt.getTime()) / (1000 * 60 * 60);
      console.log(`Session Validity Duration: ${durationHours.toFixed(2)} hours (${(durationHours / 24).toFixed(1)} days)`);
    } else {
      console.log("No session record found in database!");
    }

    // 3. Session Rotation on Re-login
    console.log("\n--- 3. SESSION ROTATION ON RE-LOGIN ---");
    const firstToken = sessionRecord?.token;
    const loginRes2 = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        email: "admin@millledger.local",
        password: "AdminPassword123!",
      }),
    });
    const setCookie2 = loginRes2.headers.get("set-cookie") || "";
    const sessionRecord2 = await prisma.session.findFirst({
      where: { user: { email: "admin@millledger.local" } },
      orderBy: { createdAt: "desc" },
    });
    console.log("First Session Token:", firstToken?.slice(0, 16) + "...");
    console.log("Second Session Token:", sessionRecord2?.token.slice(0, 16) + "...");
    console.log("Tokens Differ (Rotation):", firstToken !== sessionRecord2?.token);

    // 4. Concurrent Sessions
    console.log("\n--- 4. CONCURRENT SESSIONS ---");
    // Check if both sessions exist in DB
    const adminSessions = await prisma.session.findMany({
      where: { user: { email: "admin@millledger.local" } },
    });
    console.log(`Active concurrent sessions in DB for admin: ${adminSessions.length}`);
    // Test if first session cookie still works
    const firstCookieHeader = setCookie.split(";")[0];
    const testFirstRes = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { Cookie: firstCookieHeader },
    });
    console.log("First session still active after second login (HTTP status):", testFirstRes.status);

    // 5. Server-side Logout Invalidation
    console.log("\n--- 5. SERVER-SIDE LOGOUT INVALIDATION ---");
    const secondCookieHeader = setCookie2.split(";")[0];
    const logoutRes = await fetch(`${baseUrl}/api/auth/sign-out`, {
      method: "POST",
      headers: {
        Cookie: secondCookieHeader,
        Origin: "http://localhost:5173",
      },
    });
    console.log("Sign-out HTTP Status:", logoutRes.status);
    const postLogoutRecord = await prisma.session.findUnique({
      where: { token: sessionRecord2?.token || "" },
    });
    console.log("Second session record in DB after signout:", postLogoutRecord ? "STILL EXISTS (NOT INVALIDATED)" : "DELETED (INVALIDATED)");
    // Test requesting /api/v1/me with logged-out cookie
    const testLoggedOut = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { Cookie: secondCookieHeader },
    });
    console.log("Requesting /api/v1/me with logged out cookie status:", testLoggedOut.status);

    // 6. Password Reset Flow
    console.log("\n--- 6. PASSWORD RESET FLOW ---");
    const forgotRes = await fetch(`${baseUrl}/api/auth/forget-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({ email: "admin@millledger.local" }),
    });
    console.log("POST /api/auth/forget-password Status:", forgotRes.status);
    console.log("POST /api/auth/forget-password Response:", await forgotRes.text());

    // 7. Brute Force Protection and Account Lockout
    console.log("\n--- 7. BRUTE FORCE PROTECTION & LOCKOUT ---");
    console.log("Testing 6 consecutive failed logins on salesman1@millledger.local...");
    const failedStatuses: number[] = [];
    for (let i = 1; i <= 6; i++) {
      const failRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          email: "salesman1@millledger.local",
          password: `WrongPass${i}!`,
        }),
      });
      failedStatuses.push(failRes.status);
    }
    console.log("Failed attempt status codes:", failedStatuses);
    // Check if account is locked by trying correct password
    const legitRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        email: "salesman1@millledger.local",
        password: "SalesmanPassword123!",
      }),
    });
    console.log("Login with valid password immediately following 6 failures status:", legitRes.status);
    const salesmanUser = await prisma.user.findUnique({
      where: { email: "salesman1@millledger.local" },
    });
    console.log("User isActive state:", salesmanUser?.isActive);

    // 8. User Enumeration Testing (Error Message & Timing)
    console.log("\n--- 8. USER ENUMERATION TESTING ---");
    const enumStartNonexistent = performance.now();
    const nonExistentRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        email: "doesnotexist999@millledger.local",
        password: "SomePassword123!",
      }),
    });
    const nonExistentTime = performance.now() - enumStartNonexistent;
    const nonExistentBody = await nonExistentRes.text();

    const enumStartExisting = performance.now();
    const existingRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        email: "admin@millledger.local",
        password: "WrongPassword123!",
      }),
    });
    const existingTime = performance.now() - enumStartExisting;
    const existingBody = await existingRes.text();

    console.log(`Nonexistent user response (${nonExistentTime.toFixed(1)}ms, status ${nonExistentRes.status}):`, nonExistentBody);
    console.log(`Existing user wrong pass response (${existingTime.toFixed(1)}ms, status ${existingRes.status}):`, existingBody);
    console.log("Error messages identical:", nonExistentBody === existingBody);
    console.log("Timing difference (ms):", Math.abs(existingTime - nonExistentTime).toFixed(1));

  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

main().catch(console.error);
