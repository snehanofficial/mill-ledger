import { describe, expect, it } from "vitest";
import { isAllowedOrigin, isPrivateNetworkOrLoopback } from "./origins.js";

describe("Origin validation and OWASP protection", () => {
  describe("isPrivateNetworkOrLoopback", () => {
    it("recognizes localhost and loopback IP addresses", () => {
      expect(isPrivateNetworkOrLoopback("http://localhost:5173")).toBe(true);
      expect(isPrivateNetworkOrLoopback("http://127.0.0.1:4000")).toBe(true);
      expect(isPrivateNetworkOrLoopback("http://[::1]:5173")).toBe(true);
    });

    it("recognizes RFC 1918 private IPv4 ranges (LAN IPs)", () => {
      // 10.0.0.0/8
      expect(isPrivateNetworkOrLoopback("http://10.10.70.209:5173")).toBe(true);
      expect(isPrivateNetworkOrLoopback("http://10.0.0.1:3000")).toBe(true);

      // 172.16.0.0/12
      expect(isPrivateNetworkOrLoopback("http://172.16.0.5:5173")).toBe(true);
      expect(isPrivateNetworkOrLoopback("http://172.31.255.255:5173")).toBe(
        true,
      );
      expect(isPrivateNetworkOrLoopback("http://172.32.0.1:5173")).toBe(false);

      // 192.168.0.0/16
      expect(isPrivateNetworkOrLoopback("http://192.168.1.100:5173")).toBe(
        true,
      );
      expect(isPrivateNetworkOrLoopback("http://192.168.0.1:8080")).toBe(true);
    });

    it("rejects public domains and malicious spoof attempts", () => {
      expect(isPrivateNetworkOrLoopback("https://evil.com")).toBe(false);
      expect(isPrivateNetworkOrLoopback("http://attacker.org:5173")).toBe(
        false,
      );
      expect(isPrivateNetworkOrLoopback("http://10.attacker.com:5173")).toBe(
        false,
      );
      expect(isPrivateNetworkOrLoopback("http://192.168.evil.com")).toBe(false);
      expect(isPrivateNetworkOrLoopback("javascript:alert(1)")).toBe(false);
    });
  });

  describe("isAllowedOrigin in development", () => {
    it("allows local dev origins and RFC 1918 LAN IPs", () => {
      expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
      expect(isAllowedOrigin("http://10.10.70.209:5173")).toBe(true);
      expect(isAllowedOrigin("http://192.168.1.50:5173")).toBe(true);
    });

    it("rejects unlisted public web origins to prevent CSRF per OWASP", () => {
      expect(isAllowedOrigin("https://evil-hacker.com")).toBe(false);
      expect(isAllowedOrigin("https://phishing-site.org")).toBe(false);
      expect(isAllowedOrigin("http://malicious.io")).toBe(false);
      expect(isAllowedOrigin(undefined)).toBe(false);
      expect(isAllowedOrigin("")).toBe(false);
    });
  });
});
