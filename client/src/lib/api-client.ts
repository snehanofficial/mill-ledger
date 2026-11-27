import axios from "axios";
import { BACKEND_URL } from "./env";
import { ApiContractError } from "./api-contracts";

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
export function extractErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred",
): string {
  if (error instanceof ApiContractError) {
    return error.message;
  }
  if (!error || typeof error !== "object") return fallback;
  const e = error as {
    code?: unknown;
    response?: { status?: number; data?: { message?: unknown } };
    message?: unknown;
  };
  if (e.code === "ECONNABORTED") {
    return "The request timed out. Please check your connection and try again.";
  }
  if (e.response?.status === 429) {
    return "Too many requests. Please wait a moment before trying again.";
  }
  if (
    typeof e.response?.data?.message === "string" &&
    e.response.data.message.trim().length > 0
  ) {
    return e.response.data.message;
  }
  if (!e.response && e.message === "Network Error") {
    return "Unable to reach the server. Check your internet connection and try again.";
  }
  if (typeof e.message === "string" && e.message.trim().length > 0) {
    return e.message;
  }
  return fallback;
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

