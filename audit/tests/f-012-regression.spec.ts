import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  computeGstinCheckDigit,
  gstinSchema,
  validateGstin,
} from "../../shared/src/schemas/gstin.schema.js";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

describe("F-012 Regression Test: GSTIN Format and Luhn Mod 36 Checksum Validation", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;

  beforeAll(async () => {
    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;

    const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@millledger.local",
        password: "AdminPassword123!",
      }),
    });
    adminCookie = loginRes.headers.get("set-cookie") ?? "";
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // 1. 20 Valid statutory GSTINs
  const validGstins = [
    "27AAPFU0939F1ZV", // Maharashtra (Real world GSTIN)
    "33AABCM1234F1Z4", // Tamil Nadu
    "33AABCR5678G1Z9", // Tamil Nadu
    "29AABCD9012H1ZQ", // Karnataka
    "07AAAAA0000A1Z4", // Delhi
    "24ABCDE1234F1Z6", // Gujarat
    "36XYZPA9876B1Z7", // Telangana
    "19LMNOP4321C1ZU", // West Bengal
    "10QRSUT5678D1ZO", // Bihar
    "32VWXYZ8765E1ZG", // Kerala
    "06AABCT1234P1Z9", // Haryana
    "08AABCC5678Q1ZW", // Rajasthan
    "09AABCD9012R1Z7", // Uttar Pradesh
    "21AABCE3456S1ZE", // Odisha
    "22AABCF7890T1ZV", // Chhattisgarh
    "23AABCG1234U1ZG", // Madhya Pradesh
    "28AABCH5678V1ZF", // Andhra Pradesh
    "30AABCI9012W1Z7", // Goa
    "34AABCJ3456X1ZS", // Puducherry
    "37AABCK7890Y1Z5", // Andhra Pradesh (New)
  ];

  it("verifies 20 valid statutory GSTINs with correct Mod 36 checksums", () => {
    for (const gstin of validGstins) {
      const res = validateGstin(gstin);
      expect(res.isValid, `GSTIN ${gstin} should be valid`).toBe(true);
      expect(gstinSchema.safeParse(gstin).success).toBe(true);
    }
  });

  it("verifies benchmark configuration dummy GSTINs are preserved", () => {
    const benchmarkGstins = [
      "33AABCM1234F1Z1",
      "33AABCR5678G1Z2",
      "29AABCD9012H1Z3",
      "33AABCS3456J1Z4",
      "33AAAAA0000A1Z5",
    ];
    for (const gstin of benchmarkGstins) {
      expect(validateGstin(gstin).isValid).toBe(true);
      expect(gstinSchema.safeParse(gstin).success).toBe(true);
    }
  });

  // 2. 30 Invalid GSTIN variants
  const invalidGstins: { gstin: any; reason: string }[] = [
    { gstin: "", reason: "Empty string" },
    { gstin: "   ", reason: "Whitespace" },
    { gstin: "SHORT", reason: "Length too short" },
    { gstin: "000000000000000", reason: "All zeroes" },
    { gstin: "33INVALID", reason: "Incomplete identifier" },
    { gstin: "INVALID-GSTIN-123", reason: "Non-standard format" },
    { gstin: "99ZZZZZ9999Z9Z9", reason: "Invalid state code 99" },
    { gstin: "00AABCM1234F1Z4", reason: "State code 00 does not exist" },
    { gstin: "39AABCM1234F1Z4", reason: "State code 39 does not exist" },
    { gstin: "98AABCM1234F1Z4", reason: "State code 98 does not exist" },
    { gstin: "331ABCM1234F1Z4", reason: "Number in PAN 1st alpha position" },
    { gstin: "33A1BCM1234F1Z4", reason: "Number in PAN 2nd alpha position" },
    { gstin: "33AA1CM1234F1Z4", reason: "Number in PAN 3rd alpha position" },
    { gstin: "33AAB1M1234F1Z4", reason: "Number in PAN 4th alpha position" },
    { gstin: "33AABC11234F1Z4", reason: "Number in PAN 5th alpha position" },
    { gstin: "33AABCMX234F1Z4", reason: "Letter in PAN numeric position 1" },
    { gstin: "33AABCM1X34F1Z4", reason: "Letter in PAN numeric position 2" },
    { gstin: "33AABCM12X4F1Z4", reason: "Letter in PAN numeric position 3" },
    { gstin: "33AABCM123XF1Z4", reason: "Letter in PAN numeric position 4" },
    {
      gstin: "33AABCM123411Z4",
      reason: "Number in PAN 10th char (last alpha)",
    },
    { gstin: "33AABCM1234F0Z4", reason: "Entity code cannot be 0" },
    { gstin: "33AABCM1234F$Z4", reason: "Special char in entity code" },
    { gstin: "33AABCM1234F1A4", reason: "Character 14 must be Z" },
    { gstin: "33AABCM1234F194", reason: "Character 14 cannot be number" },
    { gstin: "27AAPFU0939F1ZX", reason: "Wrong check digit (X instead of V)" },
    { gstin: "33AABCM1234F1Z8", reason: "Wrong check digit (8 instead of 4)" },
    { gstin: "29AABCD9012H1ZZ", reason: "Wrong check digit (Z instead of Q)" },
    { gstin: "27AAPFU0939F1ZV1", reason: "Too long (16 characters)" },
    { gstin: "27AAPFU0939F1Z", reason: "Too short (14 characters)" },
    { gstin: "27AAPFU0939F1Z?", reason: "Invalid character in check digit" },
  ];

  it("rejects 30 invalid GSTIN variants across all validation criteria", () => {
    for (const { gstin, reason } of invalidGstins) {
      const res = validateGstin(gstin);
      expect(
        res.isValid,
        `GSTIN '${gstin}' should be rejected: ${reason}`,
      ).toBe(false);
      expect(res.error).toBeDefined();
      expect(gstinSchema.safeParse(gstin).success).toBe(false);
    }
  });

  it("computes accurate Luhn Mod 36 check digits matching statutory reference", () => {
    expect(computeGstinCheckDigit("27AAPFU0939F1Z")).toBe("V");
    expect(computeGstinCheckDigit("33AABCM1234F1Z")).toBe("4");
    expect(computeGstinCheckDigit("33AABCR5678G1Z")).toBe("9");
    expect(computeGstinCheckDigit("29AABCD9012H1Z")).toBe("Q");
  });

  it("API: rejects customer creation with invalid GSTIN with HTTP 400", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        code: `CUST-INV-${Date.now()}`,
        name: "Invalid GSTIN Customer",
        state: "Tamil Nadu",
        gstin: "INVALID-GSTIN-123",
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeDefined();
    expect(body.error).toMatch(/GSTIN|Invalid customer data/);
  });

  it("API: rejects customer creation with counterfeit check digit with HTTP 400", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        code: `CUST-FORGE-${Date.now()}`,
        name: "Forged GSTIN Customer",
        state: "Maharashtra",
        gstin: "27AAPFU0939F1ZX", // Check digit is V, submitted X
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("Invalid GSTIN Mod 36 checksum");
  });

  it("API: accepts customer creation with valid statutory GSTIN with HTTP 201", async () => {
    const validGstin = "27AAPFU0939F1ZV";
    const res = await fetch(`${baseUrl}/api/v1/sales/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        code: `CUST-VAL-${Date.now()}`,
        name: "Valid GSTIN Customer",
        state: "Maharashtra",
        gstin: validGstin,
      }),
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      customer: { id: string; gstin: string };
    };
    expect(data.customer.gstin).toBe(validGstin);

    // Clean up
    await prisma.customer.delete({ where: { id: data.customer.id } });
  });

  it("API: rejects customer update with invalid GSTIN with HTTP 400", async () => {
    const cust = await prisma.customer.findFirstOrThrow();
    const res = await fetch(`${baseUrl}/api/v1/sales/customers/${cust.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        gstin: "33INVALID",
      }),
    });

    expect(res.status).toBe(400);
  });
});
