import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  addNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearNotifications,
  installToastInterceptor,
} from "../../client/src/lib/notifications-store";
import { toast } from "../../client/node_modules/sonner";

describe("F-065 Regression Test: Toast Accessibility, Focus Pause, and Persistent Store (WCAG 2.2 SC 4.1.3, 2.2.1, 1.4.13)", () => {
  const sonnerPath = path.resolve(
    __dirname,
    "../../client/src/components/ui/sonner.tsx",
  );
  const shellPath = path.resolve(
    __dirname,
    "../../client/src/components/shell/authenticated-shell.tsx",
  );

  beforeEach(() => {
    clearNotifications();
  });

  it("verifies notifications store manages state, persistence, and read flags", () => {
    expect(getNotifications()).toEqual([]);

    const notif1 = addNotification({
      title: "Order #SO-101 created",
      description: "Batch reserved 50 KG",
      type: "success",
    });

    expect(getNotifications().length).toBe(1);
    expect(getNotifications()[0].read).toBe(false);
    expect(getNotifications()[0].title).toBe("Order #SO-101 created");

    const notif2 = addNotification({
      title: "Low stock alert",
      type: "warning",
    });

    expect(getNotifications().length).toBe(2);

    markAsRead(notif1.id);
    expect(getNotifications().find((n) => n.id === notif1.id)?.read).toBe(true);
    expect(getNotifications().find((n) => n.id === notif2.id)?.read).toBe(false);

    markAllAsRead();
    expect(getNotifications().every((n) => n.read)).toBe(true);

    clearNotifications();
    expect(getNotifications().length).toBe(0);
  });

  it("verifies toast calls are automatically recorded into the persistent notification store", () => {
    installToastInterceptor();

    toast.success("GST Invoice #INV-2026-001 posted");
    const notifications = getNotifications();
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    const latest = notifications[0];
    expect(latest.title).toContain("GST Invoice #INV-2026-001 posted");
    expect(latest.type).toBe("success");
    expect(latest.read).toBe(false);
  });

  it("verifies sonner.tsx applies role=status, aria-live=polite, and focus pause handling", () => {
    const sonnerSource = fs.readFileSync(sonnerPath, "utf8");

    // Must set role=status, aria-live=polite, and aria-atomic=true
    expect(sonnerSource).toContain('toast.setAttribute("role", "status")');
    expect(sonnerSource).toContain('toast.setAttribute("aria-live", "polite")');
    expect(sonnerSource).toContain('toast.setAttribute("aria-atomic", "true")');

    // Must handle focusin and focusout to pause dismissals on keyboard focus
    expect(sonnerSource).toContain('addEventListener("focusin", handleFocusIn)');
    expect(sonnerSource).toContain('addEventListener("focusout", handleFocusOut)');
    expect(sonnerSource).toContain("mouseenter");
    expect(sonnerSource).toContain("mouseleave");

    // Adequate duration
    expect(sonnerSource).toContain("duration={6000}");
  });

  it("verifies authenticated-shell.tsx integrates persistent notification drawer and unread badge", () => {
    const shellSource = fs.readFileSync(shellPath, "utf8");

    // Must import useNotifications
    expect(shellSource).toContain('import { useNotifications } from "@/lib/notifications-store"');

    // Must connect unreadCount to Header badge
    expect(shellSource).toContain("notificationCount={unreadCount || notificationCount}");

    // Must render notifications sheet with list, mark all read, and clear
    expect(shellSource).toContain("Mark all read");
    expect(shellSource).toContain("Clear all notifications");
    expect(shellSource).toContain("notifications.map");
  });
});
