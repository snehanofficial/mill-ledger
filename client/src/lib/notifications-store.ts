import { useSyncExternalStore } from "react";
import { toast as sonnerToast } from "sonner";

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  type: "success" | "error" | "warning" | "info";
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = "millledger_notifications_v1";
const MAX_NOTIFICATIONS = 50;

let memoryNotifications: AppNotification[] = [];
let isInitialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function loadInitialNotifications(): AppNotification[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_NOTIFICATIONS);
    }
  } catch {
    // Ignore storage errors
  }
  return [];
}

function saveNotifications(items: AppNotification[]) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)),
    );
  } catch {
    // Ignore quota errors
  }
}

function ensureInitialized() {
  if (!isInitialized) {
    memoryNotifications = loadInitialNotifications();
    isInitialized = true;
  }
}

export function addNotification(
  input: Omit<AppNotification, "id" | "timestamp" | "read"> & {
    id?: string;
    timestamp?: number;
  },
): AppNotification {
  ensureInitialized();
  const newNotif: AppNotification = {
    id: input.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: input.title,
    description: input.description,
    type: input.type,
    timestamp: input.timestamp || Date.now(),
    read: false,
  };

  memoryNotifications = [newNotif, ...memoryNotifications].slice(
    0,
    MAX_NOTIFICATIONS,
  );
  saveNotifications(memoryNotifications);
  notify();
  return newNotif;
}

export function markAsRead(id: string) {
  ensureInitialized();
  memoryNotifications = memoryNotifications.map((n) =>
    n.id === id ? { ...n, read: true } : n,
  );
  saveNotifications(memoryNotifications);
  notify();
}

export function markAllAsRead() {
  ensureInitialized();
  memoryNotifications = memoryNotifications.map((n) => ({ ...n, read: true }));
  saveNotifications(memoryNotifications);
  notify();
}

export function clearNotifications() {
  ensureInitialized();
  memoryNotifications = [];
  saveNotifications(memoryNotifications);
  notify();
}

export function getNotifications(): AppNotification[] {
  ensureInitialized();
  return memoryNotifications;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNotifications() {
  const notifications = useSyncExternalStore(
    subscribe,
    getNotifications,
    () => [],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };
}

// ─── Automatic Sonner Toast Interception ──────────────────────────────────────
let isInterceptorInstalled = false;

export function installToastInterceptor() {
  if (isInterceptorInstalled) return;
  isInterceptorInstalled = true;

  const originalSuccess = sonnerToast.success;
  const originalError = sonnerToast.error;
  const originalWarning = sonnerToast.warning;
  const originalInfo = sonnerToast.info;
  const originalMessage = sonnerToast.message;

  function extractText(val: unknown): string {
    if (typeof val === "string") return val;
    if (typeof val === "number") return String(val);
    if (val && typeof val === "object" && "toString" in val) {
      const s = String(val);
      if (s !== "[object Object]") return s;
    }
    return "Notification";
  }

  sonnerToast.success = (message: any, data?: any) => {
    const text = extractText(message);
    const desc = data?.description ? extractText(data.description) : undefined;
    addNotification({ title: text, description: desc, type: "success" });
    return originalSuccess(message, data);
  };

  sonnerToast.error = (message: any, data?: any) => {
    const text = extractText(message);
    const desc = data?.description ? extractText(data.description) : undefined;
    addNotification({ title: text, description: desc, type: "error" });
    return originalError(message, data);
  };

  sonnerToast.warning = (message: any, data?: any) => {
    const text = extractText(message);
    const desc = data?.description ? extractText(data.description) : undefined;
    addNotification({ title: text, description: desc, type: "warning" });
    return originalWarning(message, data);
  };

  sonnerToast.info = (message: any, data?: any) => {
    const text = extractText(message);
    const desc = data?.description ? extractText(data.description) : undefined;
    addNotification({ title: text, description: desc, type: "info" });
    return originalInfo(message, data);
  };

  sonnerToast.message = (message: any, data?: any) => {
    const text = extractText(message);
    const desc = data?.description ? extractText(data.description) : undefined;
    addNotification({ title: text, description: desc, type: "info" });
    return originalMessage(message, data);
  };
}
