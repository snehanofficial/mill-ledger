import { env } from "../config/env.js";
/**
 * Checks whether an origin is a local loopback or RFC 1918 private network IP address.
 */
export function isPrivateNetworkOrLoopback(originUrl) {
    try {
        const parsed = new URL(originUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return false;
        }
        const hostname = parsed.hostname;
        // Loopback
        if (hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname === "::1" ||
            hostname === "[::1]") {
            return true;
        }
        // RFC 1918 IPv4 ranges:
        // 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
        if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
            return true;
        }
        // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
        if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
            return true;
        }
        // 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
        if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
            return true;
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Returns the list of explicitly configured origins from environment variables.
 */
export function getConfiguredOrigins() {
    const envOrigins = env.CORS_ORIGIN
        ? env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
        : [];
    const baseOrigins = [
        ...envOrigins,
        env.BETTER_AUTH_URL,
    ];
    if (env.NODE_ENV === "production") {
        return Array.from(new Set(baseOrigins));
    }
    // In non-production, include standard local dev ports
    const devOrigins = [
        ...baseOrigins,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
    ];
    return Array.from(new Set(devOrigins));
}
/**
 * OWASP-compliant origin validator:
 * - Always permits explicitly configured origins from CORS_ORIGIN / BETTER_AUTH_URL.
 * - In non-production environments (development / test), permits loopback and RFC 1918 private LAN IPs.
 * - Strictly rejects all arbitrary or public untrusted origins (e.g. evil.com).
 */
export function isAllowedOrigin(origin) {
    if (!origin)
        return false;
    let normalizedOrigin;
    try {
        normalizedOrigin = new URL(origin).origin;
    }
    catch {
        return false;
    }
    const configured = getConfiguredOrigins();
    if (configured.includes(normalizedOrigin)) {
        return true;
    }
    // In non-production only, allow RFC 1918 private network or loopback IPs
    if (env.NODE_ENV !== "production") {
        return isPrivateNetworkOrLoopback(normalizedOrigin);
    }
    return false;
}
