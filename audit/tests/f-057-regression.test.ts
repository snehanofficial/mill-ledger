import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  saveActiveFormDraft,
  getSavedFormDraft,
  clearFormDraft,
} from "../../client/src/lib/form-draft";

describe("F-057 Regression Test: Proactive Session Expiry Warning & Form Draft Preservation (WCAG 2.2 SC 2.2.1, 3.3.7)", () => {
  const repoRoot = path.resolve(__dirname, "../..");

  beforeEach(() => {
    // Clean mock sessionStorage
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.clear();
    }
  });

  it("form-draft utility correctly serializes and restores in-progress form inputs", () => {
    const storage: Record<string, string> = {};
    (globalThis as any).window = {
      sessionStorage: {
        setItem: (k: string, v: string) => {
          storage[k] = v;
        },
        getItem: (k: string) => storage[k] || null,
        removeItem: (k: string) => {
          delete storage[k];
        },
        clear: () => {
          Object.keys(storage).forEach((k) => delete storage[k]);
        },
      },
    };
    (globalThis as any).document = {
      querySelectorAll: () => [
        { id: "customer-name", value: "Murugan Traders" },
        { id: "order-qty", value: "150" },
        { id: "is-rush", type: "checkbox", checked: true },
        { id: "delivery-state", value: "Tamil Nadu" },
        { id: "notes", value: "Handle with care" },
      ],
    };

    saveActiveFormDraft("/orders/new");

    const restored = getSavedFormDraft("/orders/new");
    expect(restored).not.toBeNull();
    expect(restored?.["customer-name"]).toBe("Murugan Traders");
    expect(restored?.["order-qty"]).toBe("150");
    expect(restored?.["is-rush"]).toBe(true);
    expect(restored?.["delivery-state"]).toBe("Tamil Nadu");
    expect(restored?.["notes"]).toBe("Handle with care");

    clearFormDraft("/orders/new");
    expect(getSavedFormDraft("/orders/new")).toBeNull();
  });

  it("AuthenticatedLayout integrates proactive useSessionTimeout and saves form draft before redirect", () => {
    const layoutSource = fs.readFileSync(
      path.join(repoRoot, "client/src/layouts/authenticated-layout.tsx"),
      "utf8",
    );

    expect(layoutSource).toContain('from "@/hooks/use-session-timeout"');
    expect(layoutSource).toContain('from "@/lib/form-draft"');
    expect(layoutSource).toContain('from "@/components/shell/session-timeout-modal"');
    expect(layoutSource).toContain("saveActiveFormDraft(location.pathname)");
    expect(layoutSource).toContain("sessionExpired: true");
    expect(layoutSource).toContain("<SessionTimeoutModal");
  });

  it("SessionTimeoutModal exposes accessible alertdialog semantics with autofocus extend action", () => {
    const modalSource = fs.readFileSync(
      path.join(repoRoot, "client/src/components/shell/session-timeout-modal.tsx"),
      "utf8",
    );

    expect(modalSource).toContain('role="alertdialog"');
    expect(modalSource).toContain("Session Expiration Warning");
    expect(modalSource).toContain("Extend Session");
    expect(modalSource).toContain("autoFocus");
    expect(modalSource).toContain("அமர்வு காலாவதி எச்சரிக்கை");
    expect(modalSource).toContain("formatDuration");
  });

  it("LoginPage informs the user when returning after an expired session", () => {
    const loginSource = fs.readFileSync(
      path.join(repoRoot, "client/src/pages/login-page.tsx"),
      "utf8",
    );

    expect(loginSource).toContain("sessionExpired?: boolean");
    expect(loginSource).toContain("isSessionExpired");
    expect(loginSource).toContain("Session Expired");
    expect(loginSource).toContain("Your session expired due to inactivity");
    expect(loginSource).toContain("அமர்வு காலாவதியானது");
  });
});
