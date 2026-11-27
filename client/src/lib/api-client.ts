import axios from "axios";
import { BACKEND_URL } from "./env";
import { ApiContractError } from "./api-contracts";
import { i18n } from "@/i18n";

export const apiClient = axios.create({
  baseURL: `${BACKEND_URL}/api/v1`,
  withCredentials: true,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

// OWASP: Handle session expiration and 401 Unauthorized across active API requests
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      // Ignore passive session verification requests to avoid triggering unnecessary reload loops
      if (!url.includes("/me") && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("millledger:unauthorized"));
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Extracts a human-readable error message from API errors across Axios response
 * structures or standard Error instances.
 */
export function extractErrorMessage(error: unknown, fallback?: string): string {
  const defaultFallback = fallback || i18n.t("errors:generic");
  if (error instanceof ApiContractError) {
    return error.message;
  }
  if (!error || typeof error !== "object") return defaultFallback;
  const e = error as {
    code?: unknown;
    response?: {
      status?: number;
      data?: { code?: unknown; message?: unknown };
    };
    message?: unknown;
  };
  if (e.code === "ECONNABORTED") {
    return i18n.t("errors:timeout");
  }
  if (e.response?.status === 429) {
    return i18n.t("errors:rateLimited");
  }
  if (e.response?.status === 401) {
    return i18n.t("errors:unauthorized");
  }
  if (e.response?.status === 403) {
    return i18n.t("errors:forbidden");
  }
  const serverCode =
    typeof e.response?.data?.code === "string"
      ? e.response.data.code.trim().toUpperCase()
      : undefined;
  if (serverCode && i18n.exists(`errors:codes.${serverCode}`)) {
    return (i18n.t as unknown as (key: string) => string)(
      `errors:codes.${serverCode}`,
    );
  }
  if (
    typeof e.response?.data?.message === "string" &&
    e.response.data.message.trim().length > 0
  ) {
    return e.response.data.message;
  }
  if (!e.response && e.message === "Network Error") {
    return i18n.t("errors:network");
  }
  if (typeof e.message === "string" && e.message.trim().length > 0) {
    return e.message;
  }
  return defaultFallback;
}

/**
 * Extracts correlation request ID from API errors across Axios response structures,
 * headers, or standard error objects.
 */
export function extractRequestId(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as {
    response?: {
      data?: { requestId?: string };
      headers?: Record<string, string | undefined>;
    };
    requestId?: string;
  };
  return (
    e.response?.data?.requestId ||
    e.response?.headers?.["x-request-id"] ||
    e.requestId
  );
}
