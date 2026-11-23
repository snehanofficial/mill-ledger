import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { lockoutService, MAX_FAILED_ATTEMPTS } from "./lib/lockout.js";

describe("F-024: Password Reset Endpoint and Account Lockout Policy", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    lockoutService.reset();
  });

  beforeEach(() => {
    lockoutService.reset();
  });

  describe("Password Reset Endpoint (/api/auth/forget-password)", () => {
    it("returns HTTP 200 for valid email (previously returned 404)", async () => {
      const res = await fetch(`${baseUrl}/api/auth/forget-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          email: "admin@millledger.local",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe(true);
      expect(data.message).toBeDefined();
    });

    it("returns HTTP 200 without leaking account existence for non-existent email (anti-enumeration)", async () => {
      const res = await fetch(`${baseUrl}/api/auth/forget-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          email: "nonexistent-user-12345@millledger.local",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe(true);
    });
  });

  describe("Account Lockout Policy on Successive Failed Logins", () => {
    const targetEmail = "salesman1@millledger.local";
    const validPassword = "SalesmanPassword123!";

    it("locks the account after 5 consecutive failed attempts and blocks subsequent logins", async () => {
      // 1. Send 5 failed login attempts
      for (let attempt = 1; attempt <= MAX_FAILED_ATTEMPTS; attempt++) {
        const failRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:5173",
          },
          body: JSON.stringify({
            email: targetEmail,
            password: `WrongPassword_${attempt}!`,
          }),
        });

        expect(failRes.status).toBe(401);
      }

      // Account should now be locked
      expect(lockoutService.isLocked(targetEmail)).toBe(true);

      // 2. 6th failed attempt should be blocked with 403 Forbidden and ACCOUNT_LOCKED
      const sixthAttempt = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          email: targetEmail,
          password: "WrongPassword_6!",
        }),
      });

      expect(sixthAttempt.status).toBe(403);
      const sixthData = await sixthAttempt.json();
      expect(sixthData.code).toBe("ACCOUNT_LOCKED");

      // 3. Attempt with CORRECT password while locked must also be rejected with 403
      const validAttemptWhileLocked = await fetch(
        `${baseUrl}/api/auth/sign-in/email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:5173",
          },
          body: JSON.stringify({
            email: targetEmail,
            password: validPassword,
          }),
        },
      );

      expect(validAttemptWhileLocked.status).toBe(403);
      const lockedData = await validAttemptWhileLocked.json();
      expect(lockedData.code).toBe("ACCOUNT_LOCKED");

      // 4. Once lockout is reset (e.g. timeout expires or admin unlocks), login succeeds
      lockoutService.reset(targetEmail);
      expect(lockoutService.isLocked(targetEmail)).toBe(false);

      const successRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          email: targetEmail,
          password: validPassword,
        }),
      });

      expect(successRes.status).toBe(200);
      const successData = await successRes.json();
      expect(successData.user.email).toBe(targetEmail);
      expect(lockoutService.getFailedAttempts(targetEmail)).toBe(0);
    });

    it("resets failed attempt counter upon successful login before reaching threshold", async () => {
      // 2 failed attempts
      for (let attempt = 1; attempt <= 2; attempt++) {
        await fetch(`${baseUrl}/api/auth/sign-in/email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:5173",
          },
          body: JSON.stringify({
            email: targetEmail,
            password: "WrongPassword!",
          }),
        });
      }

      expect(lockoutService.getFailedAttempts(targetEmail)).toBe(2);

      // Successful login resets counter
      const successRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          email: targetEmail,
          password: validPassword,
        }),
      });

      expect(successRes.status).toBe(200);
      expect(lockoutService.getFailedAttempts(targetEmail)).toBe(0);
      expect(lockoutService.isLocked(targetEmail)).toBe(false);
    });
  });
});
